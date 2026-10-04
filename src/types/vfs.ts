export type NodeType = 'file' | 'directory' | 'symlink';

export interface VFSNode {
  id: string;
  name: string;
  type: NodeType;
  parentId: string | null;
  createdAt: number;
  modifiedAt: number;
  permissions: string; // e.g., 'rw-r--r--'
  owner: string;
}

export interface FileNode extends VFSNode {
  type: 'file';
  content: string; // For text files, base64 for binary, or empty for IndexedDB-stored binary
  mimeType: string;
  size: number;
  isBinary: boolean;
  storageKey?: string; // IndexedDB key for binary files (visitor uploads)
  assetPath?: string; // Static asset path for built-in files (e.g., '/portfolio/images/photo.jpg')
}

export interface DirectoryNode extends VFSNode {
  type: 'directory';
  children: string[]; // Array of child node IDs
}

export interface SymlinkNode extends VFSNode {
  type: 'symlink';
  target: string; // Path to target
}

export type AnyVFSNode = FileNode | DirectoryNode | SymlinkNode;

export interface VFSState {
  nodes: Record<string, AnyVFSNode>;
  rootId: string;
  cwd: string; // Current working directory path
}

export interface VFSOperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface VFSStatResult {
  name: string;
  type: NodeType;
  size: number;
  permissions: string;
  owner: string;
  createdAt: number;
  modifiedAt: number;
  path: string;
  mimeType?: string;
  isBinary?: boolean;
  assetPath?: string; // Static asset path for built-in files
  storageKey?: string; // IndexedDB key for binary files
  target?: string; // for symlinks
}