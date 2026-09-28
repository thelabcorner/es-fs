#target illustrator
(function () {
    var report = { ok: false, assertions: [], environment: {}, 'native': null };
    var root = null;
    var source = null;
    var target = null;
    var missing = null;
    function check(name, condition) {
        report.assertions.push({ name: name, ok: condition === true });
        if (condition !== true) throw new Error('assertion failed: ' + name);
    }
    function cleanup() {
        try { if (target && target.exists) target.remove(); } catch (ignoreTarget) {}
        try { if (source && source.exists) source.remove(); } catch (ignoreSource) {}
        try { if (root && root.exists) root.remove(); } catch (ignoreRoot) {}
    }
    try {
        report.environment = { illustrator: app.version, engine: $.version, os: $.os };
        var probeFile = File($.fileName);
        var esfsBundle = new File(probeFile.parent.parent.fsName + '/dist/ESFS.jsx');
        if (!esfsBundle.exists) throw new Error('ESFS build not found at ' + esfsBundle.fsName);
        $.evalFile(esfsBundle);
        if (typeof ESFS !== 'object' || !ESFS || !ESFS['native']) throw new Error('load dist/ESFS.jsx first');
        check('DLL loads from explicit opt-in', ESFS['native'].load() === true);
        report['native'] = ESFS['native'].status();
        check('native ABI revision is pinned', report['native'].abiRevision === 1);
        root = new Folder(Folder.temp.fsName + '/esfs-native-' + (new Date()).getTime());
        check('temporary folder created', root.create() === true);
        source = new File(root.fsName + '/source.bin');
        target = new File(root.fsName + '/target with spaces.bin');
        missing = new File(root.fsName + '/missing.bin');
        ESFS.writeBinary(source, String.fromCharCode(0, 1, 127, 128, 255));
        check('native fileExists true', ESFS['native'].fileExists(source) === true);
        check('native fileExists false for missing file', ESFS['native'].fileExists(missing) === false);
        check('native fileSize exact', ESFS['native'].fileSize(source) === 5);
        ESFS['native'].copyFile(source, target);
        check('native copy preserves bytes including NUL', ESFS.readBinary(target) === ESFS.readBinary(source));
        check('copy reports exact size', ESFS['native'].fileSize(target) === 5);
        check('missing file size reports error', (function () {
            try { ESFS['native'].fileSize(missing); return false; }
            catch (sizeError) { return String(sizeError).indexOf('Win32 error') >= 0; }
        }()));
        report.ok = true;
    } catch (error) {
        report.error = String(error);
        report['native'] = ESFS && ESFS['native'] ? ESFS['native'].status() : null;
    } finally {
        cleanup();
        try {
            if (typeof ESFS === 'object' && ESFS && ESFS['native']) ESFS['native'].unload();
        } catch (ignoreUnload) {}
    }
    if (!report.ok) throw new Error('ESFS native probe failed: ' + (report.toSource ? report.toSource() : String(report.error)));
    return report.toSource ? report.toSource() : String(report.ok);
}());
