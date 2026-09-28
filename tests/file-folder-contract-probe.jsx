#target illustrator
(function () {
    var report = {
        ok: false,
        environment: {},
        encoding: {},
        constructors: {},
        create: {},
        missingRead: {},
        text: {},
        bom: {},
        binary: {},
        rename: {},
        copy: {},
        folders: {},
        performance: [],
        cleanup: { ok: false, errors: [] }
    };
    var root = null;
    var filePaths = [];
    var folderPaths = [];

    function addUnique(list, value) {
        var i;
        for (i = 0; i < list.length; i++) {
            if (list[i] === value) return;
        }
        list.push(value);
    }

    function newFile(path) {
        var file = new File(path);
        addUnique(filePaths, file.fsName);
        return file;
    }

    function newFolder(path) {
        var folder = new Folder(path);
        addUnique(folderPaths, folder.fsName);
        return folder;
    }

    function errorText(error) {
        var number = "";
        try {
            number = String(error.number);
        } catch (ignoredNumber) {
            number = "unavailable";
        }
        return { message: String(error), number: number };
    }

    function readError(file) {
        try {
            return file.error;
        } catch (error) {
            return "getter threw: " + String(error);
        }
    }

    function readText(path, encoding, lineFeed) {
        var file = newFile(path);
        var opened = false;
        var text = "";
        var closeResult = null;
        var readResult = null;
        var fileError = "";
        try {
            file.encoding = encoding;
            file.lineFeed = lineFeed;
            opened = file.open("r");
            if (opened) {
                text = file.read();
                readResult = true;
                closeResult = file.close();
                opened = false;
            } else {
                readResult = false;
            }
            fileError = readError(file);
        } catch (error) {
            if (opened) {
                try { file.close(); } catch (ignoredClose) {}
            }
            return { threw: errorText(error), fileError: readError(file) };
        }
        return {
            opened: readResult,
            closeResult: closeResult,
            fileError: fileError,
            text: text,
            length: text.length
        };
    }

    function writeText(path, text, encoding, lineFeed) {
        var file = newFile(path);
        var opened = false;
        var writeResult = null;
        var closeResult = null;
        var fileError = "";
        var length = null;
        try {
            file.encoding = encoding;
            file.lineFeed = lineFeed;
            opened = file.open("w");
            if (opened) {
                writeResult = file.write(text);
                closeResult = file.close();
                opened = false;
            }
            fileError = readError(file);
            length = file.length;
        } catch (error) {
            if (opened) {
                try { file.close(); } catch (ignoredClose) {}
            }
            return { threw: errorText(error), fileError: readError(file) };
        }
        return {
            opened: opened === false && closeResult !== null,
            writeType: typeof writeResult,
            writeResult: writeResult,
            closeResult: closeResult,
            fileError: fileError,
            length: length
        };
    }

    function codeUnits(text, maxCount) {
        var values = [];
        var limit = text.length;
        var i;
        if (limit > maxCount) limit = maxCount;
        for (i = 0; i < limit; i++) {
            values.push(text.charCodeAt(i));
        }
        return values;
    }

    function makeByteString(count) {
        var text = "";
        var i;
        for (i = 0; i < count; i++) {
            text += String.fromCharCode(i);
        }
        return text;
    }

    function readBinary(path) {
        var file = newFile(path);
        var opened = false;
        var text = "";
        var closeResult = null;
        try {
            file.encoding = "BINARY";
            file.lineFeed = "Unix";
            opened = file.open("r");
            if (opened) {
                text = file.read();
                closeResult = file.close();
                opened = false;
            }
            return {
                opened: opened === false && closeResult !== null,
                closeResult: closeResult,
                length: text.length,
                firstCodes: codeUnits(text, 8),
                lastCode: text.length > 0 ? text.charCodeAt(text.length - 1) : null,
                all256: text.length === 256 && codeUnits(text, 256).length === 256 &&
                    text.charCodeAt(0) === 0 && text.charCodeAt(255) === 255
            };
        } catch (error) {
            if (opened) {
                try { file.close(); } catch (ignoredClose) {}
            }
            return { threw: errorText(error), fileError: readError(file) };
        }
    }

    function median(values) {
        var sorted = [];
        var i;
        for (i = 0; i < values.length; i++) sorted.push(values[i]);
        sorted.sort(function (a, b) { return a - b; });
        return sorted[Math.floor(sorted.length / 2)];
    }

    function repeatedText(length) {
        var text = "x";
        while (text.length < length) text = text + text;
        return text.substring(0, length);
    }

    function timedWrite(path, payload, chunkSize) {
        var file = newFile(path);
        var opened = false;
        var writes = 0;
        var offset = 0;
        var closeResult = null;
        var start;
        var elapsed;
        file.encoding = "BINARY";
        file.lineFeed = "Unix";
        start = $.hiresTimer;
        opened = file.open("w");
        if (!opened) throw new Error("benchmark write open failed: " + readError(file));
        if (chunkSize === 0) {
            file.write(payload);
            writes = 1;
        } else {
            while (offset < payload.length) {
                file.write(payload.substring(offset, offset + chunkSize));
                writes++;
                offset += chunkSize;
            }
        }
        closeResult = file.close();
        opened = false;
        elapsed = $.hiresTimer;
        if (elapsed < 0) throw new Error("benchmark write timer wrapped");
        if (closeResult === false) throw new Error("benchmark write close failed: " + readError(file));
        if (file.length !== payload.length) throw new Error("benchmark write length mismatch");
        return { us: elapsed, writes: writes };
    }

    function timedRead(path, expectedLength) {
        var file = newFile(path);
        var opened = false;
        var text = "";
        var start;
        var elapsed;
        var closeResult = null;
        file.encoding = "BINARY";
        file.lineFeed = "Unix";
        start = $.hiresTimer;
        opened = file.open("r");
        if (!opened) throw new Error("benchmark read open failed: " + readError(file));
        text = file.read();
        closeResult = file.close();
        opened = false;
        elapsed = $.hiresTimer;
        if (elapsed < 0) throw new Error("benchmark read timer wrapped");
        if (closeResult === false) throw new Error("benchmark read close failed: " + readError(file));
        if (text.length !== expectedLength) throw new Error("benchmark read length mismatch");
        return { us: elapsed };
    }

    function benchmarkSize(size) {
        var payload = repeatedText(size);
        var wholePath = root.fsName + "/perf-whole-" + size + ".bin";
        var chunkedPath = root.fsName + "/perf-chunked-" + size + ".bin";
        var writeWhole = [];
        var writeChunked = [];
        var readWhole = [];
        var i;
        var sample;
        for (i = 0; i < 8; i++) {
            sample = timedWrite(wholePath, payload, 0);
            if (i > 0) writeWhole.push(sample.us);
            sample = timedWrite(chunkedPath, payload, 16384);
            if (i > 0) writeChunked.push(sample.us);
            sample = timedRead(wholePath, size);
            if (i > 0) readWhole.push(sample.us);
        }
        return {
            bytes: size,
            warmups: 1,
            repetitions: 7,
            chunkBytes: 16384,
            wholeStringWriteMedianUs: median(writeWhole),
            chunkedWriteMedianUs: median(writeChunked),
            readMedianUs: median(readWhole),
            wholeWriteCalls: 1,
            chunkedWriteCalls: Math.ceil(size / 16384),
            methodCallsWholeWrite: 3,
            methodCallsChunkedWrite: 2 + Math.ceil(size / 16384),
            methodCallsRead: 3,
            fileObjectsPerOperation: 1,
            payloadConstructionTimed: false
        };
    }

    function attempt(callback) {
        try {
            return { ok: true, value: callback() };
        } catch (error) {
            return { ok: false, error: errorText(error) };
        }
    }

    function cleanup() {
        var errors = [];
        var i;
        var file;
        var folder;
        var removed;
        for (i = filePaths.length - 1; i >= 0; i--) {
            try {
                file = new File(filePaths[i]);
                if (file.exists) {
                    removed = file.remove();
                    if (removed === false) errors.push("file remove failed: " + filePaths[i] + " " + readError(file));
                }
            } catch (fileError) {
                errors.push("file cleanup threw: " + filePaths[i] + " " + String(fileError));
            }
        }
        for (i = folderPaths.length - 1; i >= 0; i--) {
            try {
                folder = new Folder(folderPaths[i]);
                if (folder.exists) {
                    removed = folder.remove();
                    if (removed === false) errors.push("folder remove failed: " + folderPaths[i] + " " + folder.error);
                }
            } catch (folderError) {
                errors.push("folder cleanup threw: " + folderPaths[i] + " " + String(folderError));
            }
        }
        if (root) {
            try {
                if (root.exists) {
                    removed = root.remove();
                    if (removed === false) errors.push("probe root remove failed: " + root.fsName + " " + root.error);
                }
                report.cleanup.rootExistsAfter = root.exists;
            } catch (rootError) {
                errors.push("probe root cleanup threw: " + String(rootError));
                report.cleanup.rootExistsAfter = true;
            }
        }
        report.cleanup.errors = errors;
        report.cleanup.ok = errors.length === 0 && report.cleanup.rootExistsAfter === false;
    }

    function probe() {
        var temp = Folder.temp;
        var attemptIndex;
        var rootCreated = false;
        var rootName;
        var rootCreateResult = false;
        var filePath;
        var file;
        var textResult;
        var rawFile;
        var rawBytes;
        var bomPath;
        var bomText;
        var bytePath;
        var byteFile;
        var byteString;
        var missing;
        var missingOpen;
        var createFile;
        var createFirst;
        var createSecond;
        var factoryFile;
        var factoryFolder;
        var spacedFile;
        var uriFile;
        var fsNameFile;
        var replaceOld;
        var replaceStage;
        var renameResult;
        var replaceRead;
        var copySource;
        var copyTarget;
        var copyResult;
        var copyRead;
        var moveDirectory;
        var moveSource;
        var moveResult;
        var moveTarget;
        var parentDirectory;
        var nestedDirectory;
        var nestedCreate;
        var nonemptyDirectory;
        var childPath;
        var nonemptyRemove;
        var encodingAvailable;
        var i;

        report.environment = {
            illustrator: app.version,
            os: $.os,
            engine: $.engineName,
            filesystem: File.fs,
            folderTemp: temp.fsName
        };

        for (attemptIndex = 0; attemptIndex < 8; attemptIndex++) {
            rootName = "esfs-contract-" + (new Date()).getTime() + "-" +
                Math.floor(Math.random() * 1000000) + "-" + attemptIndex;
            root = newFolder(temp.fsName + "/" + rootName);
            rootCreateResult = root.create();
            if (rootCreateResult) {
                rootCreated = true;
                break;
            }
        }
        if (!rootCreated) throw new Error("unable to create unique probe directory");

        report.environment.probeRoot = root.fsName;
        encodingAvailable = {
            utf8: File.isEncodingAvailable("UTF-8"),
            binary: File.isEncodingAvailable("BINARY"),
            ascii: File.isEncodingAvailable("ASCII")
        };
        report.encoding.available = encodingAvailable;

        filePath = root.fsName + "/sample.txt";
        file = newFile(filePath);
        file.encoding = "UTF-8";
        file.lineFeed = "Unix";
        report.constructors.fileWithNew = file instanceof File;
        report.constructors.newFileOnFolder = new File(root.fsName).exists;
        factoryFolder = File(root.fsName);
        report.constructors.fileCallOnFolderReturnsFolder = factoryFolder instanceof Folder;
        factoryFile = File(filePath);
        report.constructors.fileCallOnFileReturnsFile = factoryFile instanceof File;

        createFile = newFile(root.fsName + "/created.txt");
        createFirst = createFile.create();
        createSecond = createFile.create();
        report.create = {
            first: createFirst,
            second: createSecond,
            existsAfterSecond: createFile.exists,
            errorAfterSecond: readError(createFile)
        };

        missing = newFile(root.fsName + "/missing.txt");
        missing.encoding = "UTF-8";
        missingOpen = missing.open("r");
        if (missingOpen) missing.close();
        report.missingRead = {
            openResult: missingOpen,
            existsAfterOpen: missing.exists,
            error: readError(missing)
        };

        textResult = writeText(filePath, "A\r\nB\rC\n", "UTF-8", "Unix");
        report.text.write = textResult;
        report.text.readUnix = readText(filePath, "UTF-8", "Unix");
        report.text.readWindows = readText(filePath, "UTF-8", "Windows");
        rawFile = newFile(filePath);
        rawFile.encoding = "BINARY";
        rawFile.lineFeed = "Unix";
        if (rawFile.open("r")) {
            rawBytes = rawFile.read();
            rawFile.close();
            report.text.rawBinaryLength = rawBytes.length;
            report.text.rawBinaryCodes = codeUnits(rawBytes, 24);
        }

        bomPath = root.fsName + "/bom.txt";
        report.bom.write = writeText(bomPath, "\uFEFFbom", "UTF-8", "Unix");
        bomText = readText(bomPath, "UTF-8", "Unix");
        report.bom.utf8Read = bomText;

        bytePath = root.fsName + "/all-bytes.bin";
        byteString = makeByteString(256);
        byteFile = newFile(bytePath);
        byteFile.encoding = "BINARY";
        byteFile.lineFeed = "Unix";
        if (byteFile.open("w")) {
            report.binary.writeReturnType = typeof byteFile.write(byteString);
            report.binary.closeResult = byteFile.close();
            report.binary.length = byteFile.length;
        } else {
            report.binary.openError = readError(byteFile);
        }
        report.binary.read = readBinary(bytePath);

        spacedFile = newFile(root.fsName + "/space name.txt");
        report.binary.pathWrite = writeText(spacedFile.fsName, "space", "UTF-8", "Unix");
        uriFile = newFile(spacedFile.fullName);
        fsNameFile = newFile(spacedFile.fsName);
        report.constructors.paths = {
            fsName: spacedFile.fsName,
            fullName: spacedFile.fullName,
            uriRoundTripExists: uriFile.exists,
            fsNameRoundTripExists: fsNameFile.exists,
            uriRoundTripFsNameEqual: uriFile.fsName === spacedFile.fsName,
            fsNameRoundTripEqual: fsNameFile.fsName === spacedFile.fsName
        };

        replaceOld = newFile(root.fsName + "/replace-target.txt");
        replaceStage = newFile(root.fsName + "/replace-stage.txt");
        writeText(replaceOld.fsName, "old", "UTF-8", "Unix");
        writeText(replaceStage.fsName, "new", "UTF-8", "Unix");
        renameResult = attempt(function () { return replaceStage.rename(replaceOld.name); });
        replaceRead = readText(replaceOld.fsName, "UTF-8", "Unix");
        report.rename.replaceExisting = {
            result: renameResult,
            sourceExistsAfter: new File(replaceStage.fsName).exists,
            destinationExistsAfter: new File(replaceOld.fsName).exists,
            destinationTextAfter: replaceRead.text,
            destinationError: readError(new File(replaceOld.fsName))
        };

        copySource = newFile(root.fsName + "/copy-source.txt");
        copyTarget = newFile(root.fsName + "/copy-target.txt");
        writeText(copySource.fsName, "source", "UTF-8", "Unix");
        writeText(copyTarget.fsName, "before", "UTF-8", "Unix");
        copyResult = attempt(function () { return copySource.copy(copyTarget.fsName); });
        copyRead = readText(copyTarget.fsName, "UTF-8", "Unix");
        report.copy.overExisting = {
            result: copyResult,
            sourceExistsAfter: copySource.exists,
            targetTextAfter: copyRead.text,
            targetError: readError(new File(copyTarget.fsName))
        };

        moveDirectory = newFolder(root.fsName + "/move-destination");
        moveDirectory.create();
        moveSource = newFile(root.fsName + "/move-source.txt");
        writeText(moveSource.fsName, "move", "UTF-8", "Unix");
        moveResult = attempt(function () {
            return moveSource.rename(moveDirectory.fsName + "/moved.txt");
        });
        moveTarget = newFile(moveDirectory.fsName + "/moved.txt");
        report.rename.crossDirectory = {
            result: moveResult,
            sourceExistsAfter: new File(moveSource.fsName).exists,
            targetExistsAfter: moveTarget.exists,
            targetFsName: moveTarget.fsName
        };

        parentDirectory = newFolder(root.fsName + "/missing-parent");
        nestedDirectory = newFolder(parentDirectory.fsName + "/child");
        nestedCreate = nestedDirectory.create();
        report.folders.createMissingParents = {
            createResult: nestedCreate,
            parentExists: parentDirectory.exists,
            childExists: nestedDirectory.exists,
            error: nestedDirectory.error
        };

        nonemptyDirectory = newFolder(root.fsName + "/nonempty");
        nonemptyDirectory.create();
        childPath = root.fsName + "/nonempty/child.txt";
        writeText(childPath, "child", "UTF-8", "Unix");
        nonemptyRemove = attempt(function () { return nonemptyDirectory.remove(); });
        report.folders.removeNonempty = {
            result: nonemptyRemove,
            folderExistsAfter: nonemptyDirectory.exists,
            childExistsAfter: new File(childPath).exists,
            error: nonemptyDirectory.error
        };

        report.performance.push(benchmarkSize(1024));
        report.performance.push(benchmarkSize(65536));
        report.performance.push(benchmarkSize(1048576));
        report.ok = true;
    }

    try {
        probe();
    } catch (error) {
        report.ok = false;
        report.fatal = errorText(error);
    } finally {
        cleanup();
    }

    return report;
}());
