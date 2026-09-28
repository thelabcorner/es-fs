import fs from 'node:fs';
import path from 'node:path';

function freshCounts() {
  return {
    fileObjects: 0, folderObjects: 0, existsReads: 0, lengthReads: 0,
    errorReads: 0, parentReads: 0, nameReads: 0, fullNameReads: 0,
    createdReads: 0, modifiedReads: 0, openCalls: 0, readCalls: 0,
    writeCalls: 0, closeCalls: 0, seekCalls: 0, copyCalls: 0, renameCalls: 0,
    removeCalls: 0, createCalls: 0, listCalls: 0, siblingFileCalls: 0,
    renameSiblingCalls: 0, encodingAvailableCalls: 0, encodingWrites: 0,
    lineFeedWrites: 0
  };
}

function lineBreak(name) {
  if (name === 'Windows') return '\r\n';
  if (name === 'Macintosh') return '\r';
  return '\n';
}

function isNotFound(error) {
  return error && (error.code === 'ENOENT' || error.code === 'ENOTDIR');
}

class NodeFile {
  constructor(adapter, filePath) {
    this.adapter = adapter;
    this.path = path.resolve(filePath);
    this._error = '';
    this._encoding = 'UTF-8';
    this._lineFeed = 'Unix';
    this.fd = null;
    adapter.counts.fileObjects++;
  }

  get error() { this.adapter.counts.errorReads++; return this._error; }
  set error(value) { this._error = String(value || ''); }
  get encoding() { return this._encoding; }
  set encoding(value) { this.adapter.counts.encodingWrites++; this._encoding = value; }
  get lineFeed() { return this._lineFeed; }
  set lineFeed(value) { this.adapter.counts.lineFeedWrites++; this._lineFeed = value; }

  get exists() {
    this.adapter.counts.existsReads++;
    try { return fs.statSync(this.path).isFile(); }
    catch (error) {
      if (isNotFound(error)) return false;
      this._error = String(error.message || error);
      return false;
    }
  }

  get length() {
    this.adapter.counts.lengthReads++;
    try { return fs.statSync(this.path).size; }
    catch (error) { this._error = String(error.message || error); return 0; }
  }

  get created() {
    this.adapter.counts.createdReads++;
    try { return fs.statSync(this.path).birthtime; } catch (error) { return null; }
  }

  get modified() {
    this.adapter.counts.modifiedReads++;
    try { return fs.statSync(this.path).mtime; } catch (error) { return null; }
  }

  get readonly() {
    try { return (fs.statSync(this.path).mode & 0o222) === 0; } catch (error) { return false; }
  }
  get alias() { return false; }
  get hidden() { return path.basename(this.path).charAt(0) === '.'; }
  get type() { return '????'; }
  get name() { this.adapter.counts.nameReads++; return path.basename(this.path); }
  get fsName() { return this.path; }
  get fullName() { this.adapter.counts.fullNameReads++; return this.path; }
  get parent() { this.adapter.counts.parentReads++; return this.adapter.folder(path.dirname(this.path)); }

  open(mode) {
    this.adapter.counts.openCalls++;
    if (this.adapter.shouldFail('open')) { this._error = 'injected open failure'; return false; }
    try {
      this.fd = fs.openSync(this.path, mode === 'r' ? 'r' : mode === 'a' ? 'a' : 'w');
      return true;
    } catch (error) { this._error = String(error.message || error); return false; }
  }

  seek(position, mode) {
    this.adapter.counts.seekCalls++;
    return position === 0 && (mode === undefined || mode === 0) && this.fd !== null;
  }

  read() {
    this.adapter.counts.readCalls++;
    if (this.adapter.shouldFail('read')) throw new Error('injected read failure');
    if (this.fd === null) throw new Error('read without an open descriptor');
    var data = fs.readFileSync(this.fd);
    if (this._encoding.toUpperCase() === 'BINARY') return data.toString('latin1');
    var text = data.toString('utf8');
    if (this._encoding.toUpperCase() === 'UTF-8' && text.charCodeAt(0) === 0xFEFF) text = text.substring(1);
    return text;
  }

  write(text) {
    this.adapter.counts.writeCalls++;
    if (this.adapter.shouldFail('write')) { this._error = 'injected write failure'; return false; }
    if (this.fd === null) { this._error = 'write without an open descriptor'; return false; }
    try {
      var output = text;
      var encoding = this._encoding.toUpperCase();
      var buffer;
      if (encoding === 'BINARY') {
        buffer = Buffer.from(output, 'latin1');
      } else {
        if (encoding === 'ASCII' && /[^\x00-\x7F]/.test(output)) {
          this._error = 'ASCII encoding cannot write characters above 0x7F';
          return false;
        }
        output = output.replace(/\r\n|\r|\n/g, lineBreak(this._lineFeed));
        buffer = Buffer.from(output, encoding === 'ASCII' ? 'ascii' : 'utf8');
      }
      return fs.writeSync(this.fd, buffer, 0, buffer.length) === buffer.length;
    } catch (error) { this._error = String(error.message || error); return false; }
  }

  close() {
    this.adapter.counts.closeCalls++;
    var injectedFailure = this.adapter.shouldFail('close');
    if (this.fd === null) return false;
    try {
      fs.closeSync(this.fd);
      this.fd = null;
      if (injectedFailure) { this._error = 'injected close failure'; return false; }
      return true;
    } catch (error) { this._error = String(error.message || error); this.fd = null; return false; }
  }

  copy(target) {
    this.adapter.counts.copyCalls++;
    if (this.adapter.shouldFail('copy')) { this._error = 'injected copy failure'; return false; }
    try {
      var destination = typeof target === 'string' ? target : target.fsName;
      fs.copyFileSync(this.path, destination);
      return true;
    } catch (error) { this._error = String(error.message || error); return false; }
  }

  rename(newName) {
    this.adapter.counts.renameCalls++;
    if (this.adapter.shouldFail('rename')) { this._error = 'injected rename failure'; return false; }
    if (/[\\/]/.test(newName)) { this._error = 'rename requires a leaf name'; return false; }
    try {
      var nextPath = path.join(path.dirname(this.path), newName);
      fs.renameSync(this.path, nextPath);
      this.path = nextPath;
      return true;
    } catch (error) { this._error = String(error.message || error); return false; }
  }

  remove() {
    this.adapter.counts.removeCalls++;
    if (this.adapter.shouldFail('remove')) { this._error = 'injected remove failure'; return false; }
    try { fs.unlinkSync(this.path); return true; }
    catch (error) { this._error = String(error.message || error); return false; }
  }
}

class NodeFolder {
  constructor(adapter, folderPath) {
    this.adapter = adapter;
    this.path = path.resolve(folderPath);
    this._error = '';
    adapter.counts.folderObjects++;
  }

  get error() { this.adapter.counts.errorReads++; return this._error; }
  set error(value) { this._error = String(value || ''); }

  get exists() {
    this.adapter.counts.existsReads++;
    try { return fs.statSync(this.path).isDirectory(); }
    catch (error) {
      if (isNotFound(error)) return false;
      this._error = String(error.message || error);
      return false;
    }
  }

  get created() {
    this.adapter.counts.createdReads++;
    try { return fs.statSync(this.path).birthtime; } catch (error) { return null; }
  }

  get modified() {
    this.adapter.counts.modifiedReads++;
    try { return fs.statSync(this.path).mtime; } catch (error) { return null; }
  }

  get alias() { return false; }
  get name() { this.adapter.counts.nameReads++; return path.basename(this.path); }
  get fsName() { return this.path; }
  get fullName() { this.adapter.counts.fullNameReads++; return this.path; }

  get parent() {
    this.adapter.counts.parentReads++;
    var parentPath = path.dirname(this.path);
    if (parentPath === this.path) return null;
    return this.adapter.folder(parentPath);
  }

  create() {
    this.adapter.counts.createCalls++;
    if (this.adapter.shouldFail('create')) { this._error = 'injected create failure'; return false; }
    try { fs.mkdirSync(this.path); return true; }
    catch (error) { this._error = String(error.message || error); return false; }
  }

  remove() {
    this.adapter.counts.removeCalls++;
    if (this.adapter.shouldFail('remove')) { this._error = 'injected remove failure'; return false; }
    try { fs.rmdirSync(this.path); return true; }
    catch (error) { this._error = String(error.message || error); return false; }
  }

  getFiles(mask) {
    this.adapter.counts.listCalls++;
    if (!this.exists) return null;
    try {
      var names = fs.readdirSync(this.path);
      var matcher = null;
      var entries = [];
      var i;
      var name;
      var childPath;
      var childStat;
      var entry;
      if (typeof mask === 'string') {
        var escaped = mask.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
        matcher = new RegExp('^' + escaped + '$');
      }
      for (i = 0; i < names.length; i++) {
        name = names[i];
        childPath = path.join(this.path, name);
        childStat = fs.statSync(childPath);
        entry = childStat.isDirectory() ? this.adapter.folder(childPath) : this.adapter.file(childPath);
        if (typeof mask === 'function') {
          if (mask(entry)) entries.push(entry);
        } else if (!matcher || matcher.test(name)) {
          entries.push(entry);
        }
      }
      return entries;
    } catch (error) { this._error = String(error.message || error); throw error; }
  }
}

export class NodeAdapter {
  constructor() {
    this.counts = freshCounts();
    this.failures = {};
  }

  resetCounts() { this.counts = freshCounts(); }
  failOn(method, callNumber) { this.failures[method] = callNumber; }
  clearFailures() { this.failures = {}; }

  shouldFail(method) {
    var countName = method + 'Calls';
    return this.failures[method] === this.counts[countName];
  }

  file(input) { return input instanceof NodeFile ? input : new NodeFile(this, input); }
  folder(input) { return input instanceof NodeFolder ? input : new NodeFolder(this, input); }

  siblingFile(parent, leafName) {
    this.counts.siblingFileCalls++;
    return new NodeFile(this, path.join(parent.fsName, leafName));
  }

  renameSibling(source, newLeafName) {
    this.counts.renameSiblingCalls++;
    return source.rename(newLeafName);
  }

  encodingAvailable(name) {
    this.counts.encodingAvailableCalls++;
    var normalized = name.toUpperCase();
    return normalized === 'UTF-8' || normalized === 'ASCII' || normalized === 'BINARY';
  }
}
