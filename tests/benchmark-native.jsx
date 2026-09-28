#target illustrator
(function () {
    var report = { ok: false, environment: {}, sizes: [], cleanup: { ok: false } };
    var root = null;
    var source = null;
    var adobeTarget = null;
    var nativeTarget = null;
    var warmups = 2;
    var repetitions = 7;
    function median(values) {
        var sorted = values.slice(0);
        sorted.sort(function (a, b) { return a - b; });
        return sorted[Math.floor(sorted.length / 2)];
    }
    function timed(callback) {
        $.hiresTimer;
        callback();
        return $.hiresTimer;
    }
    function bytes(length) {
        var value = 'ESFS native copy benchmark\r\n';
        while (value.length < length) value += value;
        return value.substring(0, length);
    }
    function verify(target, expected) {
        if (target.length !== expected.length || ESFS.readBinary(target) !== expected) {
            throw new Error('copy lane content mismatch');
        }
    }
    function runSize(size) {
        var payload = bytes(size);
        var adobeTimes = [];
        var nativeTimes = [];
        var i;
        ESFS.writeBinary(source, payload);
        for (i = 0; i < warmups + repetitions; i++) {
            var adobeUs = timed(function () { ESFS.copyFile(source, adobeTarget); });
            var nativeUs = timed(function () { ESFS['native'].copyFile(source, nativeTarget); });
            if (i >= warmups) {
                adobeTimes.push(adobeUs);
                nativeTimes.push(nativeUs);
            }
        }
        // Reconstruct File objects after OS-side copies. Adobe File instances can
        // retain stale metadata when another API mutates the underlying path.
        verify(new File(adobeTarget.fsName), payload);
        verify(new File(nativeTarget.fsName), payload);
        return {
            bytes: size, warmups: warmups, repetitions: repetitions,
            adobeFileCopyMedianUs: median(adobeTimes),
            nativeCopyFileWMedianUs: median(nativeTimes),
            adobeSamplesUs: adobeTimes, nativeSamplesUs: nativeTimes,
            exactContentVerifiedOutsideTiming: true,
            speedup: median(adobeTimes) / median(nativeTimes)
        };
    }
    try {
        var testFile = File($.fileName);
        var esfsBundle = new File(testFile.parent.parent.fsName + '/dist/ESFS.jsx');
        if (!esfsBundle.exists) throw new Error('ESFS build not found at ' + esfsBundle.fsName);
        $.evalFile(esfsBundle);
        if (!ESFS['native'].load()) throw new Error('native load failed: ' + ESFS['native'].status().error);
        report.environment = { illustrator: app.version, engine: $.version, os: $.os, dll: ESFS['native'].status().path, timer: '$.hiresTimer primed delta' };
        root = new Folder(Folder.temp.fsName + '/esfs-native-bench-' + (new Date()).getTime());
        if (!root.create()) throw new Error('cannot create benchmark folder: ' + root.error);
        source = new File(root.fsName + '/source.bin');
        adobeTarget = new File(root.fsName + '/adobe-copy.bin');
        nativeTarget = new File(root.fsName + '/native-copy.bin');
        report.sizes.push(runSize(65536));
        report.sizes.push(runSize(1048576));
        report.ok = true;
    } catch (error) {
        report.error = String(error);
    } finally {
        try { if (source && source.exists) source.remove(); } catch (ignoreSource) {}
        try { if (adobeTarget && adobeTarget.exists) adobeTarget.remove(); } catch (ignoreAdobe) {}
        try { if (nativeTarget && nativeTarget.exists) nativeTarget.remove(); } catch (ignoreNative) {}
        try { if (root && root.exists) report.cleanup.ok = root.remove() === true; } catch (ignoreRoot) {}
        try { ESFS['native'].unload(); } catch (ignoreUnload) {}
    }
    if (!report.ok) throw new Error('ESFS native benchmark failed: ' + (report.toSource ? report.toSource() : String(report.error)));
    return report.toSource ? report.toSource() : String(report.ok);
}());
