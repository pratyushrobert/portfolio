import { v4 as uuidv4 } from 'uuid';
import type { FileNode, DirectoryNode, SymlinkNode, AnyVFSNode, NodeType } from '../../types/vfs';
import { generateStorageKey } from './binaryStorage';

export function createFileNode(
  name: string,
  parentId: string,
  content: string = '',
  mimeType: string = 'text/plain',
  isBinary: boolean = false,
  assetPath?: string
): FileNode {
  const now = Date.now();
  return {
    id: uuidv4(),
    name,
    type: 'file',
    parentId,
    createdAt: now,
    modifiedAt: now,
    permissions: 'rw-r--r--',
    owner: 'user',
    content,
    mimeType,
    size: new Blob([content]).size,
    isBinary,
    assetPath,
  };
}

export function createBinaryFileNode(
  name: string,
  parentId: string,
  mimeType: string,
  size: number,
  storageKey: string,
  assetPath?: string
): FileNode {
  const now = Date.now();
  return {
    id: uuidv4(),
    name,
    type: 'file',
    parentId,
    createdAt: now,
    modifiedAt: now,
    permissions: 'rw-r--r--',
    owner: 'user',
    content: '',
    mimeType,
    size,
    isBinary: true,
    storageKey,
    assetPath,
  };
}

export function createBuiltInBinaryFileNode(
  name: string,
  parentId: string,
  mimeType: string,
  size: number,
  assetPath: string
): FileNode {
  const now = Date.now();
  return {
    id: uuidv4(),
    name,
    type: 'file',
    parentId,
    createdAt: now,
    modifiedAt: now,
    permissions: 'rw-r--r--',
    owner: 'user',
    content: '',
    mimeType,
    size,
    isBinary: true,
    assetPath,
  };
}

export function createDirectoryNode(name: string, parentId: string | null): DirectoryNode {
  const now = Date.now();
  return {
    id: uuidv4(),
    name,
    type: 'directory',
    parentId,
    createdAt: now,
    modifiedAt: now,
    permissions: 'rwxr-xr-x',
    owner: 'user',
    children: [],
  };
}

export function createSymlinkNode(name: string, parentId: string, target: string): SymlinkNode {
  const now = Date.now();
  return {
    id: uuidv4(),
    name,
    type: 'symlink',
    parentId,
    createdAt: now,
    modifiedAt: now,
    permissions: 'lrwxrwxrwx',
    owner: 'user',
    target,
  };
}

export function isFileNode(node: AnyVFSNode): node is FileNode {
  return node.type === 'file';
}

export function isDirectoryNode(node: AnyVFSNode): node is DirectoryNode {
  return node.type === 'directory';
}

export function isSymlinkNode(node: AnyVFSNode): node is SymlinkNode {
  return node.type === 'symlink';
}

export function getNodeType(node: AnyVFSNode): NodeType {
  return node.type;
}

export function updateNodeTimestamp(node: AnyVFSNode): AnyVFSNode {
  return {
    ...node,
    modifiedAt: Date.now(),
  };
}