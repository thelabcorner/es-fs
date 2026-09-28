export type FileOpenMode = 'r' | 'w' | 'a';
export type LineFeed = 'Unix' | 'Windows' | 'Macintosh';

export interface FileObject {
  encoding: string;
  lineFeed: string;
  error: string;
  readonly exists: boolean;
  readonly length: number;
  readonly created: Date | null;
  readonly modified: Date | null;
  readonly readonly: boolean;
  readonly alias: boolean;
  readonly hidden: boolean;
  readonly type: string;
  readonly name: string;
  readonly fsName: string;
  readonly fullName: string;
  readonly parent: FolderObject;
  open(mode: FileOpenMode): boolean;
  seek(position: number, mode?: number): boolean;
  read(): string;
  write(text: string): boolean;
  close(): boolean;
  remove(): boolean;
  copy(target: string | FileObject): boolean;
  rename(newName: string): boolean;
}

export interface FolderObject {
  error: string;
  readonly exists: boolean;
  readonly created: Date | null;
  readonly modified: Date | null;
  readonly alias: boolean;
  readonly name: string;
  readonly fsName: string;
  readonly fullName: string;
  readonly parent: FolderObject | null;
  create(): boolean;
  remove(): boolean;
  getFiles(mask?: string | ((entry: FileSystemEntry) => boolean)): FileSystemEntry[] | null;
}

export type FileInput = string | FileObject;
export type FolderInput = string | FolderObject;
export type FileSystemEntry = FileObject | FolderObject;

/**
 * The sole path-construction boundary. Implementations receive path strings
 * unchanged; only sibling staging files are constructed by this adapter.
 * This leaves room for a future path authority without assuming its API.
 */
export interface PathAdapter {
  file(input: FileInput): FileObject;
  folder(input: FolderInput): FolderObject;
  siblingFile(parent: FolderObject, leafName: string): FileObject;
  renameSibling(source: FileObject, newLeafName: string): boolean;
  encodingAvailable(name: string): boolean;
}

export interface TextOptions {
  /** Defaults to UTF-8. Explicit non-default encodings are checked once per facade. */
  encoding?: string;
}

export interface TextWriteOptions extends TextOptions {
  /** Defaults to Unix for deterministic interchange files. */
  lineFeed?: LineFeed;
}

export interface FileStat {
  kind: 'file';
  exists: boolean;
  path: string;
  fullName?: string;
  name?: string;
  length?: number;
  created?: Date | null;
  modified?: Date | null;
  readonly?: boolean;
  hidden?: boolean;
  alias?: boolean;
  type?: string;
}

export interface FolderStat {
  kind: 'folder';
  exists: boolean;
  path: string;
  fullName?: string;
  name?: string;
  created?: Date | null;
  modified?: Date | null;
  alias?: boolean;
}

export interface ReplaceResult {
  committed: true;
  /** File/Folder documents no atomic replace primitive; this is best-effort. */
  atomicity: 'best-effort';
  /** close() succeeded; no fsync/durable-media primitive is exposed. */
  durability: 'close-confirmed-only';
  previousTargetMoved: boolean;
  backupRemoved: boolean;
  backupPath?: string;
}

export interface ESFSError extends Error {
  name: string;
  message: string;
  isESFSError: true;
  operation: string;
  path: string;
  detail: string;
  cause?: any;
  cleanupError?: string;
  rollbackError?: string;
}

export interface ESFSApi {
  readonly version: string;
  encodingAvailable(name: string): boolean;
  fileExists(path: FileInput): boolean;
  folderExists(path: FolderInput): boolean;
  statFile(path: FileInput): FileStat;
  statFolder(path: FolderInput): FolderStat;
  readText(path: FileInput, options?: TextOptions): string;
  writeText(path: FileInput, text: string, options?: TextWriteOptions): void;
  appendText(path: FileInput, text: string, options?: TextWriteOptions): void;
  readBinary(path: FileInput): string;
  writeBinary(path: FileInput, bytes: string): void;
  appendBinary(path: FileInput, bytes: string): void;
  writeTextReplace(path: FileInput, text: string, options?: TextWriteOptions): ReplaceResult;
  writeBinaryReplace(path: FileInput, bytes: string): ReplaceResult;
  copyFile(source: FileInput, destination: FileInput): void;
  renameFile(path: FileInput, newLeafName: string): void;
  removeFile(path: FileInput): void;
  listDirectory(path: FolderInput, mask?: string | ((entry: FileSystemEntry) => boolean)): FileSystemEntry[] | null;
  createDirectory(path: FolderInput): void;
  ensureDirectory(path: FolderInput): number;
  removeEmptyDirectory(path: FolderInput): void;
}
