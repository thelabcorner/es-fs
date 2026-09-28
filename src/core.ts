import type {
  ESFSError,
  ESFSApi,
  FileInput,
  FileObject,
  FileStat,
  FileSystemEntry,
  FolderInput,
  FolderObject,
  FolderStat,
  LineFeed,
  PathAdapter,
  ReplaceResult,
  TextOptions,
  TextWriteOptions
} from './types';

var NON_BYTE = /[^\x00-\xFF]/;
var transactionSequence = 0;

function safeText(value: any): string {
  if (value == null) return '';
  try {
    if (value.message != null) return String(value.message);
  } catch (ignoredMessage) {}
  try {
    return String(value);
  } catch (ignoredString) {
    return 'unprintable error';
  }
}

function pathLabel(input: any): string {
  if (typeof input === 'string') return input;
  try {
    if (input && input.fsName != null) return String(input.fsName);
  } catch (ignoredPath) {}
  return '<unavailable path>';
}

function makeError(operation: string, path: string, detail: string, cause?: any): ESFSError {
  var message = 'ESFS ' + operation + ' failed for ' + path;
  var error = new Error(message) as ESFSError;
  error.name = 'ESFSError';
  error.isESFSError = true;
  error.operation = operation;
  error.path = path;
  error.detail = detail || '';
  error.cause = cause;
  if (detail) error.message += ': ' + detail;
  return error;
}

function objectError(hostObject: any): string {
  var value: any;
  try {
    if (hostObject) {
      value = hostObject.error;
      if (value != null) return String(value);
    }
  } catch (ignoredError) {}
  return '';
}

function hostFailure(operation: string, input: any, hostObject: any, cause?: any): ESFSError {
  var detail = objectError(hostObject);
  var thrown = safeText(cause);
  if (thrown && thrown !== detail) detail = detail ? detail + ' | ' + thrown : thrown;
  return makeError(operation, pathLabel(input), detail, cause);
}

function inputFailure(operation: string, input: any, detail: string): ESFSError {
  return makeError(operation, pathLabel(input), detail);
}

function isESFSError(error: any): error is ESFSError {
  try {
    return !!error && error.isESFSError === true;
  } catch (ignoredMarker) {
    return false;
  }
}

function validateText(value: any, operation: string, path: any): string {
  if (typeof value !== 'string') throw inputFailure(operation, path, 'expected a string');
  return value;
}

function validateBinary(value: any, operation: string, path: any): string {
  if (typeof value !== 'string') throw inputFailure(operation, path, 'expected a BINARY byte string');
  if (NON_BYTE.test(value)) {
    throw inputFailure(operation, path, 'BINARY byte strings may contain only code units 0x00 through 0xFF');
  }
  return value;
}

function createErrorWithCleanup(error: ESFSError, cleanupError: ESFSError | null): ESFSError {
  if (cleanupError) error.cleanupError = cleanupError.message;
  return error;
}

function closeError(file: FileObject, input: any): ESFSError | null {
  try {
    if (file.close() === true) return null;
    return hostFailure('close', input, file);
  } catch (cause) {
    return hostFailure('close', input, file, cause);
  }
}

function writeHandle(
  file: FileObject,
  path: any,
  text: string,
  mode: 'w' | 'a',
  encoding: string,
  lineFeed: LineFeed,
  operation: string
): void {
  var opened = false;
  var failure: ESFSError | null = null;
  var closingFailure: ESFSError | null = null;
  try {
    file.encoding = encoding;
    file.lineFeed = lineFeed;
    if (file.open(mode) !== true) {
      failure = hostFailure(operation, path, file);
    } else {
      opened = true;
      if (file.write(text) !== true) failure = hostFailure(operation, path, file);
    }
  } catch (cause) {
    failure = hostFailure(operation, path, file, cause);
  } finally {
    if (opened) closingFailure = closeError(file, path);
  }
  if (failure) throw createErrorWithCleanup(failure, closingFailure);
  if (closingFailure) throw closingFailure;
}

function readHandle(file: FileObject, path: any, encoding: string, operation: string, binary: boolean): string {
  var opened = false;
  var failure: ESFSError | null = null;
  var closingFailure: ESFSError | null = null;
  var result = '';
  try {
    file.encoding = encoding;
    if (file.open('r') !== true) {
      failure = hostFailure(operation, path, file);
    } else {
      opened = true;
      if (binary && String(file.encoding).toUpperCase() !== 'BINARY') {
        file.encoding = 'BINARY';
        if (file.seek(0, 0) !== true) failure = hostFailure(operation, path, file);
      }
      if (!failure) {
        result = file.read();
        if (typeof result !== 'string') failure = inputFailure(operation, path, 'File.read() did not return a string');
      }
    }
  } catch (cause) {
    failure = hostFailure(operation, path, file, cause);
  } finally {
    if (opened) closingFailure = closeError(file, path);
  }
  if (failure) throw createErrorWithCleanup(failure, closingFailure);
  if (closingFailure) throw closingFailure;
  return result;
}

function safeRemoveStage(file: FileObject): string | null {
  try {
    if (file.remove() === true) return null;
    if (!file.exists) return null;
    return objectError(file) || 'temporary file could not be removed';
  } catch (cause) {
    try {
      if (!file.exists) return null;
    } catch (ignoredExists) {}
    return safeText(cause) || 'temporary file cleanup failed';
  }
}

export function createESFS(adapter: PathAdapter): ESFSApi {
  var lastCheckedEncoding: string | null = null;
  var lastEncodingAvailable = false;

  function resolveFile(input: FileInput, operation: string): FileObject {
    try {
      return adapter.file(input);
    } catch (cause) {
      throw hostFailure(operation, input, null, cause);
    }
  }

  function resolveFolder(input: FolderInput, operation: string): FolderObject {
    try {
      return adapter.folder(input);
    } catch (cause) {
      throw hostFailure(operation, input, null, cause);
    }
  }

  function selectedEncoding(options: TextOptions | undefined, defaultEncoding: string, operation: string, path: any): string {
    var encoding = options && options.encoding !== undefined ? options.encoding : defaultEncoding;
    if (typeof encoding !== 'string' || encoding.length === 0) {
      throw inputFailure(operation, path, 'encoding must be a non-empty string');
    }
    if (encoding.toUpperCase() === 'BINARY') {
      throw inputFailure(operation, path, 'use readBinary/writeBinary for BINARY data');
    }
    if (options && options.encoding !== undefined && encoding !== 'UTF-8') {
      if (lastCheckedEncoding !== encoding) {
        try {
          lastEncodingAvailable = adapter.encodingAvailable(encoding);
          lastCheckedEncoding = encoding;
        } catch (cause) {
          throw hostFailure('encodingAvailable', path, null, cause);
        }
      }
      if (!lastEncodingAvailable) throw inputFailure(operation, path, 'unsupported encoding: ' + encoding);
    }
    return encoding;
  }

  function selectedLineFeed(options: TextWriteOptions | undefined, path: any, operation: string): LineFeed {
    var lineFeed: any = options && options.lineFeed !== undefined ? options.lineFeed : 'Unix';
    if (lineFeed !== 'Unix' && lineFeed !== 'Windows' && lineFeed !== 'Macintosh') {
      throw inputFailure(operation, path, 'lineFeed must be Unix, Windows, or Macintosh');
    }
    return lineFeed;
  }

  function encodingAvailable(name: string): boolean {
    if (typeof name !== 'string' || name.length === 0) throw inputFailure('encodingAvailable', name, 'expected a non-empty encoding name');
    try {
      return adapter.encodingAvailable(name) === true;
    } catch (cause) {
      throw hostFailure('encodingAvailable', name, null, cause);
    }
  }

  function uniqueSibling(parent: FolderObject, kind: string): FileObject {
    var attempt: number;
    var leaf: string;
    var file: FileObject;
    var token: string;
    for (attempt = 0; attempt < 8; attempt++) {
      transactionSequence++;
      token = (new Date()).getTime().toString(36) + '-' + transactionSequence.toString(36) + '-' +
        Math.floor(Math.random() * 2147483647).toString(36);
      leaf = '.esfs-' + kind + '-' + token;
      try {
        file = adapter.siblingFile(parent, leaf);
      } catch (cause) {
        throw hostFailure('allocate-temporary', parent, null, cause);
      }
      try {
        if (!file.exists) return file;
      } catch (cause2) {
        throw hostFailure('check-temporary', file, file, cause2);
      }
    }
    throw inputFailure('allocate-temporary', parent, 'unable to choose an unused sibling name after 8 attempts');
  }

  function writeReplace(path: FileInput, text: string, options: TextWriteOptions | undefined, binary: boolean): ReplaceResult {
    var operation = binary ? 'writeBinaryReplace' : 'writeTextReplace';
    var encoding = binary ? 'BINARY' : selectedEncoding(options, 'UTF-8', operation, path);
    var lineFeed = selectedLineFeed(options, path, operation);
    var file = resolveFile(path, operation);
    var targetName: string;
    var targetExists: boolean;
    var targetAlias: boolean;
    var parent: FolderObject;
    var stage: FileObject;
    var backup: FileObject | null = null;
    var moved = false;
    var committed = false;
    var primary: ESFSError;
    var rollbackFailure: ESFSError | null = null;
    var cleanup: string | null;
    var backupRemoved = true;
    var result: ReplaceResult;

    if (binary) validateBinary(text, operation, path);
    else validateText(text, operation, path);

    try {
      targetName = file.name;
      targetExists = file.exists;
      targetAlias = file.alias;
      parent = file.parent;
    } catch (cause) {
      throw hostFailure(operation, path, file, cause);
    }
    if (targetAlias) throw inputFailure(operation, path, 'staged replacement of an alias/shortcut is not supported');

    stage = uniqueSibling(parent, 'stage');
    try {
      writeHandle(stage, stage, text, 'w', encoding, lineFeed, operation);
      if (targetExists) {
        backup = uniqueSibling(parent, 'backup');
        if (adapter.renameSibling(file, backup.name) !== true) throw hostFailure('move-target-to-backup', path, file);
        moved = true;
      }
      if (adapter.renameSibling(stage, targetName) !== true) throw hostFailure('publish-staged-file', path, stage);
      committed = true;
    } catch (cause) {
      if (isESFSError(cause)) primary = cause;
      else primary = hostFailure(operation, path, file, cause);
      if (moved && backup) {
        try {
          if (adapter.renameSibling(backup, targetName) !== true) {
            rollbackFailure = hostFailure('rollback-target', path, backup);
          }
        } catch (rollbackCause) {
          rollbackFailure = hostFailure('rollback-target', path, backup, rollbackCause);
        }
      }
      cleanup = safeRemoveStage(stage);
      if (rollbackFailure) primary.rollbackError = rollbackFailure.message + (rollbackFailure.detail ? ': ' + rollbackFailure.detail : '');
      if (cleanup) primary.cleanupError = cleanup;
      if (backup && rollbackFailure) primary.cleanupError = (primary.cleanupError ? primary.cleanupError + ' | ' : '') +
        'previous contents remain at ' + pathLabel(backup);
      throw primary;
    }

    if (backup) {
      try {
        if (backup.remove() !== true && backup.exists) backupRemoved = false;
      } catch (ignoredBackupCleanup) {
        try {
          backupRemoved = !backup.exists;
        } catch (ignoredBackupExists) {
          backupRemoved = false;
        }
      }
    }

    result = {
      committed: true,
      atomicity: 'best-effort',
      durability: 'close-confirmed-only',
      previousTargetMoved: targetExists,
      backupRemoved: backupRemoved
    };
    if (backup && !backupRemoved) result.backupPath = pathLabel(backup);
    return result;
  }

  var api: ESFSApi = {
    version: '0.1.0',

    encodingAvailable: encodingAvailable,

    fileExists: function (path: FileInput): boolean {
      var file = resolveFile(path, 'fileExists');
      try {
        return file.exists === true;
      } catch (cause) {
        throw hostFailure('fileExists', path, file, cause);
      }
    },

    folderExists: function (path: FolderInput): boolean {
      var folder = resolveFolder(path, 'folderExists');
      try {
        return folder.exists === true;
      } catch (cause) {
        throw hostFailure('folderExists', path, folder, cause);
      }
    },

    statFile: function (path: FileInput): FileStat {
      var file = resolveFile(path, 'statFile');
      var exists: boolean;
      var result: FileStat;
      try {
        exists = file.exists === true;
        result = { kind: 'file', exists: exists, path: pathLabel(file) };
        if (exists) {
          result.fullName = file.fullName;
          result.name = file.name;
          result.length = file.length;
          result.created = file.created;
          result.modified = file.modified;
          result.readonly = file.readonly;
          result.hidden = file.hidden;
          result.alias = file.alias;
          result.type = file.type;
        }
        return result;
      } catch (cause) {
        throw hostFailure('statFile', path, file, cause);
      }
    },

    statFolder: function (path: FolderInput): FolderStat {
      var folder = resolveFolder(path, 'statFolder');
      var exists: boolean;
      var result: FolderStat;
      try {
        exists = folder.exists === true;
        result = { kind: 'folder', exists: exists, path: pathLabel(folder) };
        if (exists) {
          result.fullName = folder.fullName;
          result.name = folder.name;
          result.created = folder.created;
          result.modified = folder.modified;
          result.alias = folder.alias;
        }
        return result;
      } catch (cause) {
        throw hostFailure('statFolder', path, folder, cause);
      }
    },

    readText: function (path: FileInput, options?: TextOptions): string {
      var encoding = selectedEncoding(options, 'UTF-8', 'readText', path);
      var file = resolveFile(path, 'readText');
      return readHandle(file, path, encoding, 'readText', false);
    },

    writeText: function (path: FileInput, text: string, options?: TextWriteOptions): void {
      var value = validateText(text, 'writeText', path);
      var encoding = selectedEncoding(options, 'UTF-8', 'writeText', path);
      var lineFeed = selectedLineFeed(options, path, 'writeText');
      var file = resolveFile(path, 'writeText');
      writeHandle(file, path, value, 'w', encoding, lineFeed, 'writeText');
    },

    appendText: function (path: FileInput, text: string, options?: TextWriteOptions): void {
      var value = validateText(text, 'appendText', path);
      var encoding = selectedEncoding(options, 'UTF-8', 'appendText', path);
      var lineFeed = selectedLineFeed(options, path, 'appendText');
      var file = resolveFile(path, 'appendText');
      writeHandle(file, path, value, 'a', encoding, lineFeed, 'appendText');
    },

    readBinary: function (path: FileInput): string {
      var file = resolveFile(path, 'readBinary');
      return readHandle(file, path, 'BINARY', 'readBinary', true);
    },

    writeBinary: function (path: FileInput, bytes: string): void {
      var value = validateBinary(bytes, 'writeBinary', path);
      var file = resolveFile(path, 'writeBinary');
      writeHandle(file, path, value, 'w', 'BINARY', 'Unix', 'writeBinary');
    },

    appendBinary: function (path: FileInput, bytes: string): void {
      var value = validateBinary(bytes, 'appendBinary', path);
      var file = resolveFile(path, 'appendBinary');
      writeHandle(file, path, value, 'a', 'BINARY', 'Unix', 'appendBinary');
    },

    writeTextReplace: function (path: FileInput, text: string, options?: TextWriteOptions): ReplaceResult {
      var value = validateText(text, 'writeTextReplace', path);
      return writeReplace(path, value, options, false);
    },

    writeBinaryReplace: function (path: FileInput, bytes: string): ReplaceResult {
      var value = validateBinary(bytes, 'writeBinaryReplace', path);
      return writeReplace(path, value, undefined, true);
    },

    copyFile: function (source: FileInput, destination: FileInput): void {
      var file = resolveFile(source, 'copyFile');
      var target: string | FileObject = typeof destination === 'string' ? destination : resolveFile(destination, 'copyFile');
      try {
        if (file.copy(target) !== true) throw hostFailure('copyFile', source, file);
      } catch (cause) {
        if (isESFSError(cause)) throw cause;
        throw hostFailure('copyFile', source, file, cause);
      }
    },

    renameFile: function (path: FileInput, newLeafName: string): void {
      var file: FileObject;
      if (typeof newLeafName !== 'string' || newLeafName.length === 0 ||
          newLeafName.indexOf('/') >= 0 || newLeafName.indexOf('\\') >= 0) {
        throw inputFailure('renameFile', path, 'newLeafName must be a non-empty file name without path separators');
      }
      file = resolveFile(path, 'renameFile');
      try {
        if (adapter.renameSibling(file, newLeafName) !== true) throw hostFailure('renameFile', path, file);
      } catch (cause) {
        if (isESFSError(cause)) throw cause;
        throw hostFailure('renameFile', path, file, cause);
      }
    },

    removeFile: function (path: FileInput): void {
      var file = resolveFile(path, 'removeFile');
      try {
        if (file.remove() !== true) throw hostFailure('removeFile', path, file);
      } catch (cause) {
        if (isESFSError(cause)) throw cause;
        throw hostFailure('removeFile', path, file, cause);
      }
    },

    listDirectory: function (path: FolderInput, mask?: string | ((entry: FileSystemEntry) => boolean)): FileSystemEntry[] | null {
      var folder = resolveFolder(path, 'listDirectory');
      try {
        return folder.getFiles(mask);
      } catch (cause) {
        throw hostFailure('listDirectory', path, folder, cause);
      }
    },

    createDirectory: function (path: FolderInput): void {
      var folder = resolveFolder(path, 'createDirectory');
      try {
        if (folder.create() !== true) throw hostFailure('createDirectory', path, folder);
      } catch (cause) {
        if (isESFSError(cause)) throw cause;
        throw hostFailure('createDirectory', path, folder, cause);
      }
    },

    ensureDirectory: function (path: FolderInput): number {
      var pending: FolderObject[] = [];
      var current: FolderObject | null = resolveFolder(path, 'ensureDirectory');
      var parent: FolderObject | null;
      var created = 0;
      var exists: boolean;
      var folder: FolderObject;
      while (current) {
        try {
          exists = current.exists === true;
        } catch (cause) {
          throw hostFailure('ensureDirectory', path, current, cause);
        }
        if (exists) break;
        pending.push(current);
        try {
          parent = current.parent;
          if (!parent || parent.fsName === current.fsName) {
            current = null;
          } else {
            current = parent;
          }
        } catch (cause2) {
          throw hostFailure('ensureDirectory', path, current, cause2);
        }
      }
      if (!current) throw inputFailure('ensureDirectory', path, 'no existing ancestor folder was found');
      while (pending.length > 0) {
        folder = pending.pop() as FolderObject;
        try {
          if (folder.create() === true) {
            created++;
          } else if (folder.exists !== true) {
            throw hostFailure('ensureDirectory', folder, folder);
          }
        } catch (cause3) {
          if (isESFSError(cause3)) throw cause3;
          throw hostFailure('ensureDirectory', folder, folder, cause3);
        }
      }
      return created;
    },

    removeEmptyDirectory: function (path: FolderInput): void {
      var folder = resolveFolder(path, 'removeEmptyDirectory');
      try {
        if (folder.remove() !== true) throw hostFailure('removeEmptyDirectory', path, folder);
      } catch (cause) {
        if (isESFSError(cause)) throw cause;
        throw hostFailure('removeEmptyDirectory', path, folder, cause);
      }
    }
  };
  return api;
}
