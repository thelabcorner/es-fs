import { FileInput, FileObject, FolderInput, FolderObject, PathAdapter } from './types';

/**
 * Adobe File/Folder adapter. Input strings pass straight to `new File` or
 * `new Folder`; ESFS does not canonicalize or reinterpret caller paths.
 */
export function createAdobePathAdapter(): PathAdapter {
  return {
    file: function (input: FileInput): FileObject {
      if (typeof input === 'string') return new File(input) as any;
      return input;
    },
    folder: function (input: FolderInput): FolderObject {
      if (typeof input === 'string') return new Folder(input) as any;
      return input;
    },
    siblingFile: function (parent: FolderObject, leafName: string): FileObject {
      // Folder.fullName is Adobe's URI path form; names here are generated
      // internal staging leaves, not caller paths.
      return new File(parent.fullName + '/' + leafName) as any;
    },
    renameSibling: function (source: FileObject, newLeafName: string): boolean {
      // File.rename accepts a leaf name (not an arbitrary destination path).
      return source.rename(newLeafName);
    },
    encodingAvailable: function (name: string): boolean {
      return File.isEncodingAvailable(name);
    }
  };
}
