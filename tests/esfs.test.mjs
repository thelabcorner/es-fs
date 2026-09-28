import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createESFS } from '../dist/esfs-core.esm.mjs';
import { NodeAdapter } from './node-adapter.mjs';

var testRoot = fs.mkdtempSync(path.join(process.cwd(), 'dist', '.esfs-tests-'));
var adapter = new NodeAdapter();
var esfs = createESFS(adapter);

test.after(function () {
  fs.rmSync(testRoot, { recursive: true, force: true });
});

test('whole text writes use one File, one open/write/close, and no existence probe', function () {
  var filePath = path.join(testRoot, 'whole.txt');
  adapter.resetCounts();
  esfs.writeText(filePath, 'alpha\r\nbeta\n', { lineFeed: 'Unix' });
  assert.equal(fs.readFileSync(filePath, 'utf8'), 'alpha\nbeta\n');
  assert.equal(adapter.counts.fileObjects, 1);
  assert.equal(adapter.counts.openCalls, 1);
  assert.equal(adapter.counts.writeCalls, 1);
  assert.equal(adapter.counts.closeCalls, 1);
  assert.equal(adapter.counts.existsReads, 0);
  assert.equal(adapter.counts.encodingWrites, 1);
  assert.equal(adapter.counts.lineFeedWrites, 1);
});

test('missing reads report the open failure without a preflight exists call', function () {
  var missing = path.join(testRoot, 'missing.txt');
  adapter.resetCounts();
  assert.throws(function () { esfs.readText(missing); }, function (error) {
    assert.equal(error.name, 'ESFSError');
    assert.equal(error.operation, 'readText');
    assert.match(error.message, /readText/);
    return true;
  });
  assert.equal(adapter.counts.fileObjects, 1);
  assert.equal(adapter.counts.openCalls, 1);
  assert.equal(adapter.counts.existsReads, 0);
  assert.equal(adapter.counts.closeCalls, 0);
  assert.equal(adapter.counts.errorReads, 1);
});

test('write failures close the file and retain the host error detail', function () {
  var filePath = path.join(testRoot, 'write-failure.txt');
  adapter.resetCounts();
  adapter.failOn('write', 1);
  assert.throws(function () { esfs.writeText(filePath, 'partial'); }, function (error) {
    assert.equal(error.operation, 'writeText');
    assert.match(error.message, /injected write failure/);
    return true;
  });
  adapter.clearFailures();
  assert.equal(adapter.counts.openCalls, 1);
  assert.equal(adapter.counts.writeCalls, 1);
  assert.equal(adapter.counts.closeCalls, 1);
  assert.equal(adapter.counts.errorReads, 1);
});

test('BINARY text round-trips every byte including NUL without an array conversion', function () {
  var filePath = path.join(testRoot, 'all-bytes.bin');
  var payload = '';
  var i;
  for (i = 0; i < 256; i++) payload += String.fromCharCode(i);
  esfs.writeBinary(filePath, payload);
  var result = esfs.readBinary(filePath);
  assert.equal(result.length, 256);
  assert.equal(result, payload);
  assert.deepEqual(fs.readFileSync(filePath), Buffer.from(payload, 'latin1'));
});

test('binary writes reject non-byte code units before constructing a File', function () {
  adapter.resetCounts();
  assert.throws(function () { esfs.writeBinary(path.join(testRoot, 'bad.bin'), 'a\u0100'); }, /0x00 through 0xFF/);
  assert.equal(adapter.counts.fileObjects, 0);
  assert.equal(adapter.counts.openCalls, 0);
});

test('text entry points reject BINARY mode so byte writes cannot silently truncate', function () {
  adapter.resetCounts();
  assert.throws(function () {
    esfs.writeText(path.join(testRoot, 'wrong-mode.txt'), '\u0100', { encoding: 'BINARY' });
  }, /use readBinary\/writeBinary/);
  assert.equal(adapter.counts.fileObjects, 0);
  assert.equal(adapter.counts.openCalls, 0);
});

test('encoding checks are opt-in for custom encodings and cached by the facade', function () {
  var filePath = path.join(testRoot, 'encoding.txt');
  adapter.resetCounts();
  esfs.writeText(filePath, 'first', { encoding: 'ASCII' });
  esfs.writeText(filePath, 'second', { encoding: 'ASCII' });
  assert.equal(adapter.counts.encodingAvailableCalls, 1);
  assert.equal(esfs.encodingAvailable('BINARY'), true);
  assert.equal(esfs.encodingAvailable('not-an-encoding'), false);
});

test('stat and existence APIs distinguish files from folders', function () {
  var filePath = path.join(testRoot, 'stat.txt');
  var dirPath = path.join(testRoot, 'stat-dir');
  esfs.writeText(filePath, 'x');
  esfs.createDirectory(dirPath);
  assert.equal(esfs.fileExists(filePath), true);
  assert.equal(esfs.folderExists(dirPath), true);
  assert.equal(esfs.statFile(filePath).length, 1);
  assert.equal(esfs.statFolder(dirPath).kind, 'folder');
  assert.equal(esfs.statFile(path.join(testRoot, 'absent')).exists, false);
});

test('ensureDirectory creates missing parents and is idempotent', function () {
  var nested = path.join(testRoot, 'parent', 'child', 'leaf');
  adapter.resetCounts();
  assert.equal(esfs.ensureDirectory(nested), 3);
  assert.equal(esfs.folderExists(nested), true);
  adapter.resetCounts();
  assert.equal(esfs.ensureDirectory(nested), 0);
  assert.equal(adapter.counts.createCalls, 0);
});

test('directory listing returns host entries and remove is empty-only', function () {
  var dir = path.join(testRoot, 'listed');
  esfs.createDirectory(dir);
  esfs.writeText(path.join(dir, 'entry.txt'), 'entry');
  var entries = esfs.listDirectory(dir, '*.txt');
  assert.equal(entries.length, 1);
  assert.equal(entries[0].name, 'entry.txt');
  assert.throws(function () { esfs.removeEmptyDirectory(dir); }, /removeEmptyDirectory/);
  assert.equal(fs.existsSync(path.join(dir, 'entry.txt')), true);
  esfs.removeFile(path.join(dir, 'entry.txt'));
  esfs.removeEmptyDirectory(dir);
});

test('copy delegates to File.copy and overwrites without a read/write buffer', function () {
  var source = path.join(testRoot, 'copy-source.txt');
  var target = path.join(testRoot, 'copy-target.txt');
  esfs.writeText(source, 'new');
  esfs.writeText(target, 'old');
  adapter.resetCounts();
  esfs.copyFile(source, target);
  assert.equal(adapter.counts.fileObjects, 1);
  assert.equal(adapter.counts.copyCalls, 1);
  assert.equal(adapter.counts.openCalls, 0);
  assert.equal(adapter.counts.readCalls, 0);
  assert.equal(adapter.counts.writeCalls, 0);
  assert.equal(fs.readFileSync(target, 'utf8'), 'new');
});

test('staged replacement commits and reports its honest atomicity and durability limits', function () {
  var target = path.join(testRoot, 'replace.txt');
  esfs.writeText(target, 'before');
  var result = esfs.writeTextReplace(target, 'after');
  assert.equal(fs.readFileSync(target, 'utf8'), 'after');
  assert.equal(result.committed, true);
  assert.equal(result.previousTargetMoved, true);
  assert.equal(result.backupRemoved, true);
  assert.equal(result.atomicity, 'best-effort');
  assert.equal(result.durability, 'close-confirmed-only');
});

test('staged replacement rolls the old target back after a publish rename failure', function () {
  var target = path.join(testRoot, 'rollback.txt');
  esfs.writeText(target, 'preserve-me');
  adapter.resetCounts();
  adapter.failOn('rename', 2);
  assert.throws(function () { esfs.writeTextReplace(target, 'new-data'); }, function (error) {
    assert.equal(error.name, 'ESFSError');
    assert.equal(error.rollbackError, undefined);
    return true;
  });
  adapter.clearFailures();
  assert.equal(fs.readFileSync(target, 'utf8'), 'preserve-me');
  assert.equal(fs.readdirSync(testRoot).some(function (name) { return name.indexOf('.esfs-backup-') === 0; }), false);
});

test('append writes preserve prior content and write one supplied string', function () {
  var filePath = path.join(testRoot, 'append.txt');
  esfs.writeText(filePath, 'first');
  adapter.resetCounts();
  esfs.appendText(filePath, '\nsecond', { lineFeed: 'Unix' });
  assert.equal(fs.readFileSync(filePath, 'utf8'), 'first\nsecond');
  assert.equal(adapter.counts.openCalls, 1);
  assert.equal(adapter.counts.writeCalls, 1);
  assert.equal(adapter.counts.closeCalls, 1);
});
