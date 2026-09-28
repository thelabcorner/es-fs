import { createESFS } from './core';
import { createAdobePathAdapter } from './adobe-adapter';
import { FileObject } from './types';

var __esfsFacade: any = createESFS(createAdobePathAdapter());
var __esfsNativeError = '';
var __esfsNativeLibrary: any = null;
var __esfsNativeRoot = '';
var __esfsBundleDir = '';
try {
  __esfsBundleDir = File($.fileName).parent.fsName;
} catch (ignoredBundlePath) {}

function __esfsDefaultNativePath(): string {
  var nativeDir: any;
  var manifest: any;
  var candidate: any;
  var name: string;
  var i: number;
  var code: number;
  try {
    if (!__esfsBundleDir) throw new Error('ESFS bundle directory is unavailable');
    nativeDir = new Folder(__esfsBundleDir + '/native');
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
    __esfsNativeError = 'Native manifest unavailable: ' + String(error);
    return '';
  }
}

/* Native calls are opt-in. Adobe File/Folder remain the default API. */
__esfsFacade['native'] = {
  load: function (dllPath?: string): boolean {
    var path = dllPath;
    var library: any;
    if (typeof ExternalObject === 'undefined') {
      __esfsNativeError = 'ExternalObject is unavailable';
      return false;
    }
    if (__esfsNativeLibrary) return true;
    if (!path) {
      path = __esfsDefaultNativePath();
      if (!path) return false;
    }
    try {
      library = new ExternalObject('lib:' + path);
      if (Number(library.version) !== 1 || typeof library.abiRevision !== 'function' ||
          Number(library.abiRevision()) !== 1 || typeof library.fileExists !== 'function' ||
          typeof library.fileSize !== 'function' || typeof library.copyFile !== 'function' ||
          typeof library.lastError !== 'function') {
        try { library.unload(); } catch (ignoredUnload) {}
        __esfsNativeError = 'DLL loaded but the required ESFSNative methods are not bound';
        return false;
      }
      __esfsNativeLibrary = library;
      __esfsNativeRoot = String(path);
      __esfsNativeError = '';
      return true;
    } catch (loadError) {
      __esfsNativeError = String(loadError);
      return false;
    }
  },
  status: function (): any {
    return {
      loaded: __esfsNativeLibrary !== null,
      path: __esfsNativeRoot,
      error: __esfsNativeError,
      abiRevision: __esfsNativeLibrary ? Number(__esfsNativeLibrary.abiRevision()) : null,
      abi: 'ESABI 0.3.1 / Windows LONG32'
    };
  },
  unload: function (): boolean {
    var library = __esfsNativeLibrary;
    if (!library) return true;
    try {
      library.unload();
      __esfsNativeLibrary = null;
      __esfsNativeRoot = '';
      return true;
    } catch (unloadError) {
      __esfsNativeError = String(unloadError);
      return false;
    }
  },
  fileExists: function (file: FileObject): boolean {
    if (!__esfsNativeLibrary) throw new Error('ESFS native backend is not loaded');
    var result = Number(__esfsNativeLibrary.fileExists(String(file.fsName)));
    if (result < 0) throw new Error('ESFS native fileExists failed; Win32 error ' + __esfsNativeLibrary.lastError(0));
    return result === 1;
  },
  fileSize: function (file: FileObject): number {
    if (!__esfsNativeLibrary) throw new Error('ESFS native backend is not loaded');
    var result = Number(__esfsNativeLibrary.fileSize(String(file.fsName)));
    if (result < 0) throw new Error('ESFS native fileSize failed; Win32 error ' + __esfsNativeLibrary.lastError(0));
    return result;
  },
  copyFile: function (source: FileObject, destination: FileObject): void {
    if (!__esfsNativeLibrary) throw new Error('ESFS native backend is not loaded');
    if (Number(__esfsNativeLibrary.copyFile(String(source.fsName), String(destination.fsName))) !== 1) {
      throw new Error('ESFS native copyFile failed; Win32 error ' + __esfsNativeLibrary.lastError(0));
    }
  }
};
var __esfsGlobal: any = null;
try {
  if (typeof $ !== 'undefined' && $.global) __esfsGlobal = $.global;
} catch (ignoredGlobal) {}
if (__esfsGlobal) __esfsGlobal['ESFS'] = __esfsFacade;
