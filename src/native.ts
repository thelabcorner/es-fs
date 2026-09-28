import { FileObject } from './types';

var nativeLibrary: any = null;
var nativePath = '';
var nativeError = '';
var nativeOwned = false;
var nativeSource = 'none';
var bundleDir = '';

try {
  bundleDir = File($.fileName).parent.fsName;
} catch (ignoredBundlePath) {}

function clearNativeState(): void {
  nativeLibrary = null;
  nativePath = '';
  nativeOwned = false;
  nativeSource = 'none';
}

function defaultNativePath(): string {
  var nativeDir: any;
  var manifest: any;
  var candidate: any;
  var name: string;
  var i: number;
  var code: number;
  try {
    if (!bundleDir) throw new Error('ESFS bundle directory is unavailable');
    nativeDir = new Folder(bundleDir + '/native');
    manifest = new File(nativeDir.fsName + '/ESFSNative.current');
    manifest.encoding = 'UTF-8';
    if (manifest.exists && manifest.open('r')) {
      name = String(manifest.read());
      manifest.close();
      if (name.length === 31 && name.substring(0, 11) === 'ESFSNative_' && name.substring(27) === '.dll') {
        for (i = 11; i < 27; i++) {
          code = name.charCodeAt(i);
          if (!((code >= 48 && code <= 57) || (code >= 97 && code <= 102))) break;
        }
        if (i === 27) {
          candidate = new File(nativeDir.fsName + '/' + name);
          if (candidate.exists) return candidate.fsName;
        }
      }
    }
    candidate = new File(nativeDir.fsName + '/release/ESFSNative.dll');
    if (candidate.exists) return candidate.fsName;
    throw new Error('no current or packaged ESFS native DLL is available');
  } catch (error) {
    try { if (manifest && manifest.opened) manifest.close(); } catch (ignoredClose) {}
    nativeError = 'Native manifest unavailable: ' + String(error);
    return '';
  }
}

function validateNativeLibrary(library: any): void {
  if (!library || Number(library.version) !== 1 || typeof library.abiRevision !== 'function' ||
      Number(library.abiRevision()) !== 1 || typeof library.fileExists !== 'function' ||
      typeof library.fileSize !== 'function' || typeof library.copyFile !== 'function' ||
      typeof library.lastError !== 'function') {
    throw new Error('DLL loaded but the required ESFSNative methods are not bound');
  }
}

export function enableNativeGate(options: any): any {
  options = options || {};
  var library = options.lib;
  validateNativeLibrary(library);
  if (nativeLibrary && nativeOwned && nativeLibrary !== library) {
    try { nativeLibrary.unload(); } catch (ignoredUnload) {}
  }
  nativeLibrary = library;
  nativePath = String(options.dllPath || options.path || '');
  nativeOwned = options.owned === true;
  nativeSource = options.source ? String(options.source) : (nativeOwned ? 'direct' : 'adopted');
  nativeError = '';
  return nativeStatus();
}

export function loadNative(dllPath?: string): boolean {
  var path = dllPath;
  var library: any;
  if (typeof ExternalObject === 'undefined') {
    nativeError = 'ExternalObject is unavailable';
    return false;
  }
  if (nativeLibrary) return true;
  if (!path) {
    path = defaultNativePath();
    if (!path) return false;
  }
  try {
    library = new ExternalObject('lib:' + path);
    try {
      enableNativeGate({ lib: library, dllPath: path, owned: true, source: 'direct' });
    } catch (gateError) {
      try { library.unload(); } catch (ignoredUnload) {}
      throw gateError;
    }
    return true;
  } catch (loadError) {
    nativeError = String(loadError);
    return false;
  }
}

export function nativeStatus(): any {
  return {
    loaded: nativeLibrary !== null,
    path: nativePath,
    error: nativeError,
    abiRevision: nativeLibrary ? Number(nativeLibrary.abiRevision()) : null,
    abi: 'ESABI 0.3.1 / Windows LONG32',
    source: nativeSource,
    owned: nativeOwned
  };
}

export function unloadNative(): boolean {
  var library = nativeLibrary;
  if (!library) return true;
  if (!nativeOwned) {
    clearNativeState();
    return true;
  }
  try {
    library.unload();
    clearNativeState();
    return true;
  } catch (unloadError) {
    nativeError = String(unloadError);
    return false;
  }
}

export function nativeFileExists(file: FileObject): boolean {
  if (!nativeLibrary) throw new Error('ESFS native backend is not loaded');
  var result = Number(nativeLibrary.fileExists(String(file.fsName)));
  if (result < 0) throw new Error('ESFS native fileExists failed; Win32 error ' + nativeLibrary.lastError(0));
  return result === 1;
}

export function nativeFileSize(file: FileObject): number {
  if (!nativeLibrary) throw new Error('ESFS native backend is not loaded');
  var result = Number(nativeLibrary.fileSize(String(file.fsName)));
  if (result < 0) throw new Error('ESFS native fileSize failed; Win32 error ' + nativeLibrary.lastError(0));
  return result;
}

export function nativeCopyFile(source: FileObject, destination: FileObject): void {
  if (!nativeLibrary) throw new Error('ESFS native backend is not loaded');
  if (Number(nativeLibrary.copyFile(String(source.fsName), String(destination.fsName))) !== 1) {
    throw new Error('ESFS native copyFile failed; Win32 error ' + nativeLibrary.lastError(0));
  }
}

export function createNativeFacade(): any {
  return {
    load: loadNative,
    status: nativeStatus,
    unload: unloadNative,
    fileExists: nativeFileExists,
    fileSize: nativeFileSize,
    copyFile: nativeCopyFile
  };
}