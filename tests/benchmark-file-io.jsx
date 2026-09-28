/*
 * Run after loading dist/ESFS.jsx in an Illustrator ExtendScript engine.
 * Returns measurements as its final expression; it writes only inside a
 * uniquely named Folder.temp child and removes the files/folder on exit.
 */
(function () {
    var NON_BYTE = /[^\x00-\xFF]/;
    var report = {
        ok: false,
        environment: {},
        sizes: [],
        cleanup: { ok: false, errors: [] }
    };
    var root = null;
    var paths = [];
    var warmups = 2;
    var repetitions = 7;
    var chunkBytes = 16384;

    function errorText(error) {
        try { return String(error.message || error); } catch (ignored) { return "unknown error"; }
    }

    function repeatedText(length) {
        var text = "x";
        while (text.length < length) text = text + text;
        return text.substring(0, length);
    }

    function median(values) {
        var sorted = values.slice(0);
        sorted.sort(function (a, b) { return a - b; });
        return sorted[Math.floor(sorted.length / 2)];
    }

    function writeOperation(path, payload, chunkSize) {
        if (NON_BYTE.test(payload)) throw new Error("chunked payload is not a BINARY byte string");
        var file = new File(path);
        var opened = false;
        var writes = 0;
        var offset = 0;
        var result = {
            file: file,
            writes: 0,
            hostCalls: {
                fileObjects: 1,
                encodingWrites: 1,
                lineFeedWrites: 1,
                openCalls: 0,
                writeCalls: 0,
                closeCalls: 0,
                existsReads: 0,
                lengthReads: 0,
                reads: 0,
                copies: 0
            }
        };
        file.encoding = "BINARY";
        file.lineFeed = "Unix";
        result.hostCalls.openCalls++;
        opened = file.open("w");
        if (!opened) throw new Error("benchmark open failed: " + file.error);
        try {
            if (chunkSize === 0) {
                result.hostCalls.writeCalls++;
                if (file.write(payload) !== true) throw new Error("whole write failed: " + file.error);
                writes = 1;
            } else {
                while (offset < payload.length) {
                    result.hostCalls.writeCalls++;
                    if (file.write(payload.substring(offset, offset + chunkSize)) !== true) {
                        throw new Error("chunked write failed: " + file.error);
                    }
                    writes++;
                    offset += chunkSize;
                }
            }
        } finally {
            result.hostCalls.closeCalls++;
            if (file.close() !== true) throw new Error("benchmark close failed: " + file.error);
        }
        result.writes = writes;
        return result;
    }

    function timedWrite(path, payload, chunkSize) {
        var operation = null;
        var elapsed;
        var timer = "$.hiresTimer (primed delta)";
        function perform() {
            if (chunkSize === 0) {
                ESFS.writeBinary(path, payload);
                operation = {
                    file: null,
                    writes: 1,
                    hostCalls: {
                        fileObjects: 1,
                        encodingWrites: 1,
                        lineFeedWrites: 1,
                        openCalls: 1,
                        writeCalls: 1,
                        closeCalls: 1,
                        existsReads: 0,
                        lengthReads: 0,
                        reads: 0,
                        copies: 0
                    }
                };
            } else {
                operation = writeOperation(path, payload, chunkSize);
            }
        }
        if (typeof ESTIMER !== "undefined" && ESTIMER && typeof ESTIMER.measureUs === "function") {
            timer = "ESTIMER.measureUs";
            elapsed = ESTIMER.measureUs(perform);
        } else {
            $.hiresTimer;
            perform();
            elapsed = $.hiresTimer;
        }
        if (elapsed === null || elapsed < 0) throw new Error("invalid timer sample: " + elapsed);
        operation.us = elapsed;
        operation.timer = timer;
        if (!operation.file) {
            operation.file = new File(path);
            operation.validationFileObjects = 1;
        } else {
            operation.validationFileObjects = 0;
        }
        operation.hostCalls.lengthReads++;
        if (operation.file.length !== payload.length) throw new Error("benchmark length mismatch");
        return operation;
    }

    function verifyFile(path, payload) {
        var file = new File(path);
        var opened = false;
        var contents = "";
        var calls = {
            fileObjects: 1,
            encodingWrites: 1,
            lineFeedWrites: 1,
            openCalls: 1,
            readCalls: 1,
            closeCalls: 1,
            existsReads: 0
        };
        file.encoding = "BINARY";
        file.lineFeed = "Unix";
        opened = file.open("r");
        if (!opened) throw new Error("validation open failed: " + file.error);
        try {
            contents = file.read();
        } finally {
            if (file.close() !== true) throw new Error("validation close failed: " + file.error);
        }
        if (contents !== payload) throw new Error("validation payload mismatch");
        return calls;
    }

    function runLane(path, payload, chunkSize) {
        var values = [];
        var sampleCalls = null;
        var i;
        var sample;
        for (i = 0; i < warmups + repetitions; i++) {
            sample = timedWrite(path, payload, chunkSize);
            if (i >= warmups) values.push(sample.us);
            sampleCalls = sample.hostCalls;
        }
        return {
            medianUs: median(values),
            samplesUs: values,
            writeCallsPerOperation: chunkSize === 0 ? 1 : Math.ceil(payload.length / chunkSize),
            lastOperationHostCalls: sampleCalls
        };
    }

    function cleanup() {
        var errors = [];
        var i;
        var file;
        for (i = paths.length - 1; i >= 0; i--) {
            try {
                file = new File(paths[i]);
                if (file.exists && file.remove() !== true) errors.push("remove failed: " + file.fsName + " " + file.error);
            } catch (error) {
                errors.push("file cleanup failed: " + paths[i] + " " + errorText(error));
            }
        }
        if (root) {
            try {
                if (root.exists && root.remove() !== true) errors.push("folder cleanup failed: " + root.fsName + " " + root.error);
            } catch (folderError) {
                errors.push("folder cleanup failed: " + errorText(folderError));
            }
        }
        report.cleanup.errors = errors;
        report.cleanup.ok = errors.length === 0;
    }

    function run() {
        var sizes = [1024, 65536, 1048576];
        var temp = Folder.temp;
        var folderName = "esfs-io-benchmark-" + (new Date()).getTime() + "-" + Math.floor(Math.random() * 1000000);
        var i;
        var size;
        var payload;
        var wholePath;
        var chunkedPath;
        var whole;
        var chunked;

        report.environment = {
            illustrator: app.version,
            engine: $.version,
            engineName: $.engineName,
            os: $.os,
            apiUnderTest: "ESFS.writeBinary for the whole-write lane",
            timer: typeof ESTIMER !== "undefined" && ESTIMER && typeof ESTIMER.measureUs === "function" ? "ESTIMER" : "primed $.hiresTimer"
        };
        if (typeof ESFS !== "object" || !ESFS || typeof ESFS.writeBinary !== "function") {
            throw new Error("load dist/ESFS.jsx before running the benchmark");
        }
        root = new Folder(temp.fullName + "/" + folderName);
        if (!root.create()) throw new Error("unable to create benchmark folder: " + root.error);

        for (i = 0; i < sizes.length; i++) {
            size = sizes[i];
            payload = repeatedText(size);
            wholePath = root.fullName + "/whole-" + size + ".bin";
            chunkedPath = root.fullName + "/chunked-" + size + ".bin";
            paths.push(wholePath);
            paths.push(chunkedPath);
            whole = runLane(wholePath, payload, 0);
            chunked = runLane(chunkedPath, payload, chunkBytes);
            whole.validationHostCalls = verifyFile(wholePath, payload);
            chunked.validationHostCalls = verifyFile(chunkedPath, payload);
            report.sizes.push({
                bytes: size,
                warmups: warmups,
                repetitions: repetitions,
                chunkBytes: chunkBytes,
                wholeWrite: whole,
                chunkedWrite: chunked,
                timedHostCallFormula: {
                    fileObjects: 1,
                    binaryValidationScans: 1,
                    propertyWrites: 2,
                    openCalls: 1,
                    wholeWriteCalls: 1,
                    chunkedWriteCalls: Math.ceil(size / chunkBytes),
                    closeCalls: 1,
                    existenceProbes: 0,
                    validationLengthReads: 1,
                    lengthReadOutsideTiming: true,
                    payloadConstructionOutsideTiming: true
                }
            });
        }
        report.ok = true;
    }

    try {
        run();
    } catch (error) {
        report.ok = false;
        report.error = errorText(error);
    } finally {
        cleanup();
    }
    return report;
}());
