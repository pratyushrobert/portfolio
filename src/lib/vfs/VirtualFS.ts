import {
  createFileNode,
  createDirectoryNode,
  createSymlinkNode,
  createBinaryFileNode,
  isFileNode,
  isDirectoryNode,
  isSymlinkNode,
  updateNodeTimestamp,
} from './nodes';
import { saveToLocalStorage, loadFromLocalStorage } from './persistence';
import { storeBinaryFile, getBinaryFile, deleteBinaryFile, generateStorageKey } from './binaryStorage';
import type {
  VFSState,
  AnyVFSNode,
  VFSOperationResult,
  FileNode,
  DirectoryNode,
  VFSStatResult,
} from '../../types/vfs';

export class VirtualFS {
  private state: VFSState;
  private listeners: Set<() => void> = new Set();

  constructor() {
    const saved = loadFromLocalStorage();
    if (saved) {
      this.state = saved;
    } else {
      this.state = this.createInitialState();
      saveToLocalStorage(this.state);
    }
  }

  private createInitialState(): VFSState {
    const root = createDirectoryNode('/', null);
    const home = createDirectoryNode('home', root.id);
    const user = createDirectoryNode('pratyush', home.id);

    // Create standard directories
    const documents = createDirectoryNode('documents', user.id);
    const projects = createDirectoryNode('projects', user.id);
    const images = createDirectoryNode('images', user.id);
    const videos = createDirectoryNode('videos', user.id);

    // Create .mimi directory
    const mimiDir = createDirectoryNode('.mimi', user.id);

    // Add children to user
    user.children = [documents.id, projects.id, images.id, videos.id, mimiDir.id];
    home.children = [user.id];
    root.children = [home.id];

    // Create etc directory
    const etc = createDirectoryNode('etc', root.id);
    root.children.push(etc.id);

    // Create about.txt
    const about = createFileNode(
      'about.txt',
      user.id,
      `Pratyush — Full-stack Developer

Passionate about building creative web experiences.
Experience across the full stack: React, TypeScript, Node.js, Python, Go.
Enjoy crafting elegant solutions to complex problems.

When not coding: exploring new technologies, contributing to open source,
or experimenting with creative coding projects.

This portfolio is itself a project — a browser-based OS simulation
built with React and TypeScript. Explore the terminal, file manager,
and other apps to see more!`
    );

    // Create contact.txt
    const contact = createFileNode(
      'contact.txt',
      user.id,
      `Contact Information

GitHub:    https://github.com/pratyush
LinkedIn:  https://linkedin.com/in/pratyush
Email:     pratyush@example.com
Website:   https://pratyush.dev`
    );

    // Create resume.pdf placeholder (text content since we can't store binary)
    const resume = createFileNode(
      'resume.pdf',
      user.id,
      `[PDF Document - Resume]

This is a placeholder for the resume PDF.
In a real implementation, this would be a base64-encoded binary file.

To view: Use the PDF viewer app or download via the file manager.`,
      'application/pdf',
      true
    );

    // Create .mimi explanation file
    const mimiInfo = createFileNode(
      'origin.txt',
      mimiDir.id,
      `MimiOS is named after Mimi, Pratyush's cat.

This portfolio is designed as a personal computer/OS belonging to me.
Mimi is the namesake and unofficial mascot. 🐱`
    );

    // Create etc/motd
    const motd = createFileNode(
      'motd',
      etc.id,
      `Welcome to MimiOS.
Hostname: mimi
User: pratyush`
    );

    // Add files to user
    user.children.push(about.id, contact.id, resume.id);

    // Add files to etc
    etc.children = [motd.id];

    // Add mimi info to .mimi dir
    mimiDir.children = [mimiInfo.id];

    return {
      nodes: {
        [root.id]: root,
        [home.id]: home,
        [user.id]: user,
        [documents.id]: documents,
        [projects.id]: projects,
        [images.id]: images,
        [videos.id]: videos,
        [mimiDir.id]: mimiDir,
        [etc.id]: etc,
        [about.id]: about,
        [contact.id]: contact,
        [resume.id]: resume,
        [mimiInfo.id]: mimiInfo,
        [motd.id]: motd,
      },
      rootId: root.id,
      cwd: '/home/pratyush',
    };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((l) => l());
    saveToLocalStorage(this.state);
  }

  private getNode(id: string): AnyVFSNode | undefined {
    return this.state.nodes[id];
  }

  private getNodeByPath(path: string): AnyVFSNode | undefined {
    if (path === '/') return this.getNode(this.state.rootId);

    const parts = path.split('/').filter(Boolean);
    let currentId = this.state.rootId;

    for (const part of parts) {
      const current = this.getNode(currentId);
      if (!current || !isDirectoryNode(current)) return undefined;

      const childId = current.children.find((id) => this.getNode(id)?.name === part);
      if (!childId) return undefined;
      currentId = childId;
    }

    return this.getNode(currentId);
  }

  private getParentId(path: string): string | undefined {
    if (path === '/') return undefined;
    const parts = path.split('/').filter(Boolean);
    if (parts.length === 1) return this.state.rootId;

    const parentPath = '/' + parts.slice(0, -1).join('/');
    return this.getNodeByPath(parentPath)?.id;
  }

  private resolvePathInternal(path: string): string {
    // Normalize: collapse multiple slashes
    path = path.replace(/\/+/g, '/');

    if (path.startsWith('/')) {
      // Absolute path - normalize . and ..
      const parts = path.split('/').filter(Boolean);
      const result: string[] = [];

      for (const part of parts) {
        if (part === '..') {
          if (result.length > 0) result.pop();
        } else if (part !== '.') {
          result.push(part);
        }
      }

      return '/' + result.join('/');
    }

    // Relative path - resolve against cwd
    const cwdParts = this.state.cwd.split('/').filter(Boolean);
    const pathParts = path.split('/').filter(Boolean);

    const result = [...cwdParts];

    for (const part of pathParts) {
      if (part === '..') {
        if (result.length > 0) result.pop();
      } else if (part !== '.') {
        result.push(part);
      }
    }

    return '/' + result.join('/');
  }

  // Public API
  getState(): VFSState {
    return this.state;
  }

  getCwd(): string {
    return this.state.cwd;
  }

  resolvePath(path: string): string {
    return this.resolvePathInternal(path);
  }

  getNodePath(id: string): string {
    const node = this.getNode(id);
    if (!node) return '';
    if (node.parentId === null) return '/';

    const parts: string[] = [];
    let current: AnyVFSNode | undefined = node;
    while (current && current.parentId !== null) {
      parts.unshift(current.name);
      current = this.getNode(current.parentId);
    }
    return '/' + parts.join('/');
  }

  setCwd(path: string): VFSOperationResult {
    const resolved = this.resolvePath(path);
    const node = this.getNodeByPath(resolved);
    if (!node || !isDirectoryNode(node)) {
      return { success: false, error: 'Not a directory' };
    }
    this.state.cwd = resolved;
    this.notify();
    return { success: true };
  }

  list(path?: string): VFSOperationResult<AnyVFSNode[]> {
    const targetPath = path ? this.resolvePath(path) : this.state.cwd;
    const node = this.getNodeByPath(targetPath);
    if (!node || !isDirectoryNode(node)) {
      return { success: false, error: 'Not a directory' };
    }
    const children = node.children.map((id) => this.getNode(id)).filter(Boolean) as AnyVFSNode[];
    return { success: true, data: children };
  }

  readFile(path: string): VFSOperationResult<string> {
    const resolved = this.resolvePath(path);
    const node = this.getNodeByPath(resolved);
    if (!node || !isFileNode(node)) {
      return { success: false, error: 'Not a file' };
    }
    // For binary files stored in IndexedDB, return empty string (content not readable as text)
    if (node.isBinary && node.storageKey) {
      return { success: true, data: '' };
    }
    return { success: true, data: node.content };
  }

  async readBinaryFile(path: string): Promise<VFSOperationResult<Blob>> {
    const resolved = this.resolvePath(path);
    const node = this.getNodeByPath(resolved);
    if (!node || !isFileNode(node)) {
      return { success: false, error: 'Not a file' };
    }
    if (!node.isBinary || !node.storageKey) {
      return { success: false, error: 'Not a binary file' };
    }
    const storedFile = await getBinaryFile(node.storageKey);
    if (!storedFile) {
      return { success: false, error: 'Binary data not found' };
    }
    return { success: true, data: storedFile.data };
  }

  writeFile(path: string, content: string, mimeType: string = 'text/plain'): VFSOperationResult {
    const resolved = this.resolvePath(path);
    const parts = resolved.split('/').filter(Boolean);
    const fileName = parts.pop()!;
    const parentPath = '/' + parts.join('/');

    const parent = this.getNodeByPath(parentPath);
    if (!parent || !isDirectoryNode(parent)) {
      return { success: false, error: 'Parent directory not found' };
    }

    // Check if file exists
    const existingId = parent.children.find((id) => this.getNode(id)?.name === fileName);
    if (existingId) {
      const existing = this.getNode(existingId);
      if (existing && isFileNode(existing)) {
        this.state.nodes[existingId] = updateNodeTimestamp({
          ...existing,
          content,
          mimeType,
          size: new Blob([content]).size,
        });
        this.notify();
        return { success: true };
      }
      return { success: false, error: 'File exists and is not a file' };
    }

    const newFile = createFileNode(fileName, parent.id, content, mimeType);
    this.state.nodes[newFile.id] = newFile;
    parent.children.push(newFile.id);
    this.state.nodes[parent.id] = updateNodeTimestamp(parent);
    this.notify();
    return { success: true };
  }

  async importBinaryFile(
    file: File,
    targetPath: string,
    onConflict: 'replace' | 'rename' | 'cancel' = 'cancel'
  ): Promise<VFSOperationResult> {
    const MAX_SIZE = 50 * 1024 * 1024; // 50 MB
    if (file.size > MAX_SIZE) {
      return { success: false, error: `File exceeds maximum size of 50 MB` };
    }

    const resolved = this.resolvePath(targetPath);
    const parts = resolved.split('/').filter(Boolean);
    const fileName = parts.pop()!;
    const parentPath = '/' + parts.join('/');

    const parent = this.getNodeByPath(parentPath);
    if (!parent || !isDirectoryNode(parent)) {
      return { success: false, error: 'Parent directory not found' };
    }

    // Check for existing file
    const existingId = parent.children.find((id) => this.getNode(id)?.name === fileName);
    if (existingId) {
      if (onConflict === 'cancel') {
        return { success: false, error: 'File already exists' };
      }
      if (onConflict === 'rename') {
        // Generate new name: name (1).ext
        const nameParts = fileName.split('.');
        const ext = nameParts.length > 1 ? '.' + nameParts.pop() : '';
        const baseName = nameParts.join('.');
        let counter = 1;
        let newName = `${baseName} (${counter})${ext}`;
        while (parent.children.some((id) => this.getNode(id)?.name === newName)) {
          counter++;
          newName = `${baseName} (${counter})${ext}`;
        }
        return this.importBinaryFile(file, `${parentPath}/${newName}`, 'cancel');
      }
      // replace: remove existing
      const existing = this.getNode(existingId!);
      if (existing && isFileNode(existing) && existing.isBinary && existing.storageKey) {
        await deleteBinaryFile(existing.storageKey);
      }
      parent.children.splice(parent.children.indexOf(existingId!), 1);
    }

    // Store binary data in IndexedDB
    const storageKey = generateStorageKey(file.name);
    await storeBinaryFile(storageKey, file, file.type || 'application/octet-stream', file.name);

    // Create VFS node with storageKey
    const newFile = createBinaryFileNode(fileName, parent.id, file.type || 'application/octet-stream', file.size, storageKey);
    this.state.nodes[newFile.id] = newFile;
    parent.children.push(newFile.id);
    this.state.nodes[parent.id] = updateNodeTimestamp(parent);
    this.notify();
    return { success: true, data: { path: `${parentPath}/${fileName}`, storageKey } };
  }

  mkdir(path: string): VFSOperationResult {
    const resolved = this.resolvePath(path);
    const parts = resolved.split('/').filter(Boolean);
    const dirName = parts.pop()!;
    const parentPath = '/' + parts.join('/');

    const parent = this.getNodeByPath(parentPath);
    if (!parent || !isDirectoryNode(parent)) {
      return { success: false, error: 'Parent directory not found' };
    }

    if (parent.children.some((id) => this.getNode(id)?.name === dirName)) {
      return { success: false, error: 'Directory already exists' };
    }

    const newDir = createDirectoryNode(dirName, parent.id);
    this.state.nodes[newDir.id] = newDir;
    parent.children.push(newDir.id);
    this.state.nodes[parent.id] = updateNodeTimestamp(parent);
    this.notify();
    return { success: true };
  }

  async rm(path: string, recursive: boolean = false): Promise<VFSOperationResult> {
    const resolved = this.resolvePath(path);
    const parts = resolved.split('/').filter(Boolean);
    const targetName = parts.pop()!;
    const parentPath = '/' + parts.join('/');

    const parent = this.getNodeByPath(parentPath);
    if (!parent || !isDirectoryNode(parent)) {
      return { success: false, error: 'Parent directory not found' };
    }

    const childIndex = parent.children.findIndex((id) => this.getNode(id)?.name === targetName);
    if (childIndex === -1) {
      return { success: false, error: 'No such file or directory' };
    }

    const childId = parent.children[childIndex];
    const child = this.getNode(childId);
    if (!child) {
      return { success: false, error: 'Node not found' };
    }

    if (isDirectoryNode(child) && child.children.length > 0 && !recursive) {
      return { success: false, error: 'Directory not empty' };
    }

    // Recursively delete children
    if (isDirectoryNode(child)) {
      for (const grandChildId of child.children) {
        await this.rmRecursive(grandChildId);
      }
    }

    // Delete binary data from IndexedDB if this is a binary file
    if (isFileNode(child) && child.isBinary && child.storageKey) {
      await deleteBinaryFile(child.storageKey);
    }

    delete this.state.nodes[childId];
    parent.children.splice(childIndex, 1);
    this.state.nodes[parent.id] = updateNodeTimestamp(parent);
    this.notify();
    return { success: true };
  }

  private async rmRecursive(id: string): Promise<void> {
    const node = this.getNode(id);
    if (!node) return;

    if (isDirectoryNode(node)) {
      for (const childId of node.children) {
        await this.rmRecursive(childId);
      }
    } else if (isFileNode(node) && node.isBinary && node.storageKey) {
      await deleteBinaryFile(node.storageKey);
    }
    delete this.state.nodes[id];
  }

  cp(sourcePath: string, destPath: string): VFSOperationResult {
    const srcResolved = this.resolvePath(sourcePath);
    const destResolved = this.resolvePath(destPath);

    const source = this.getNodeByPath(srcResolved);
    if (!source) return { success: false, error: 'Source not found' };

    const destParentPath = destResolved === '/' ? '/' : destResolved.substring(0, destResolved.lastIndexOf('/'));
    const destParent = this.getNodeByPath(destParentPath);
    if (!destParent || !isDirectoryNode(destParent)) {
      return { success: false, error: 'Destination parent not found' };
    }

    const destName = destResolved.split('/').filter(Boolean).pop()!;

    const copied = this.copyNode(source, destParent.id, destName);
    destParent.children.push(copied.id);
    this.state.nodes[destParent.id] = updateNodeTimestamp(destParent);
    this.notify();
    return { success: true };
  }

  private async copyNode(node: AnyVFSNode, newParentId: string, newName: string): Promise<AnyVFSNode> {
    if (isFileNode(node)) {
      if (node.isBinary && node.storageKey) {
        // Copy binary data to new IndexedDB entry
        const storedFile = await getBinaryFile(node.storageKey);
        if (storedFile) {
          const newStorageKey = generateStorageKey(node.name);
          await storeBinaryFile(newStorageKey, storedFile.data, storedFile.mimeType, storedFile.name);
          const copy = createBinaryFileNode(newName, newParentId, node.mimeType, node.size, newStorageKey);
          this.state.nodes[copy.id] = copy;
          return copy;
        }
      }
      const copy = createFileNode(newName, newParentId, node.content, node.mimeType, node.isBinary);
      this.state.nodes[copy.id] = copy;
      return copy;
    } else if (isDirectoryNode(node)) {
      const copy = createDirectoryNode(newName, newParentId);
      this.state.nodes[copy.id] = copy;
      for (const childId of node.children) {
        const child = this.getNode(childId);
        if (child) {
          const copiedChild = await this.copyNode(child, copy.id, child.name);
          copy.children.push(copiedChild.id);
        }
      }
      return copy;
    }
    // Symlink
    const copy = createSymlinkNode(newName, newParentId, node.target);
    this.state.nodes[copy.id] = copy;
    return copy;
  }

  mv(sourcePath: string, destPath: string): VFSOperationResult {
    const srcResolved = this.resolvePath(sourcePath);
    const destResolved = this.resolvePath(destPath);

    const source = this.getNodeByPath(srcResolved);
    if (!source) return { success: false, error: 'Source not found' };

    const srcParts = srcResolved.split('/').filter(Boolean);
    const srcName = srcParts.pop()!;
    const srcParentPath = '/' + srcParts.join('/');
    const srcParent = this.getNodeByPath(srcParentPath);
    if (!srcParent || !isDirectoryNode(srcParent)) {
      return { success: false, error: 'Source parent not found' };
    }

    const destParentPath = destResolved === '/' ? '/' : destResolved.substring(0, destResolved.lastIndexOf('/'));
    const destParent = this.getNodeByPath(destParentPath);
    if (!destParent || !isDirectoryNode(destParent)) {
      return { success: false, error: 'Destination parent not found' };
    }

    const destName = destResolved.split('/').filter(Boolean).pop()!;

    // Remove from source parent
    const srcIndex = srcParent.children.findIndex((id) => id === source.id);
    if (srcIndex !== -1) {
      srcParent.children.splice(srcIndex, 1);
      this.state.nodes[srcParent.id] = updateNodeTimestamp(srcParent);
    }

    // Add to dest parent
    source.parentId = destParent.id;
    source.name = destName;
    source.modifiedAt = Date.now();
    destParent.children.push(source.id);
    this.state.nodes[destParent.id] = updateNodeTimestamp(destParent);

    this.notify();
    return { success: true };
  }

  find(name: string, startPath?: string): VFSOperationResult<AnyVFSNode[]> {
    const start = startPath ? this.resolvePath(startPath) : this.state.cwd;
    const startNode = this.getNodeByPath(start);
    if (!startNode || !isDirectoryNode(startNode)) {
      return { success: false, error: 'Start path not a directory' };
    }

    const results: AnyVFSNode[] = [];
    this.findRecursive(startNode.id, name, results);
    return { success: true, data: results };
  }

  private findRecursive(dirId: string, name: string, results: AnyVFSNode[]): void {
    const dir = this.getNode(dirId);
    if (!dir || !isDirectoryNode(dir)) return;

    for (const childId of dir.children) {
      const child = this.getNode(childId);
      if (!child) continue;

      if (child.name.toLowerCase().includes(name.toLowerCase())) {
        results.push(child);
      }

      if (isDirectoryNode(child)) {
        this.findRecursive(child.id, name, results);
      }
    }
  }

  exists(path: string): VFSOperationResult<boolean> {
    const resolved = this.resolvePath(path);
    const node = this.getNodeByPath(resolved);
    return { success: true, data: !!node };
  }

  stat(path: string): VFSOperationResult<VFSStatResult> {
    const resolved = this.resolvePath(path);
    const node = this.getNodeByPath(resolved);
    if (!node) {
      return { success: false, error: 'No such file or directory' };
    }

    const fullPath = this.getNodePath(node.id);

    const result: VFSStatResult = {
      name: node.name,
      type: node.type,
      size: isFileNode(node) ? node.size : 0,
      permissions: node.permissions,
      owner: node.owner,
      createdAt: node.createdAt,
      modifiedAt: node.modifiedAt,
      path: fullPath,
    };

    if (isFileNode(node)) {
      result.mimeType = node.mimeType;
      result.isBinary = node.isBinary;
    } else if (isSymlinkNode(node)) {
      result.target = node.target;
    } else if (isDirectoryNode(node)) {
      // directory - no extra fields
    }

    return { success: true, data: result };
  }

  tree(path?: string, depth: number = 0): VFSOperationResult<string> {
    const targetPath = path ? this.resolvePath(path) : this.state.cwd;
    const node = this.getNodeByPath(targetPath);
    if (!node) return { success: false, error: 'Path not found' };

    let output = '';
    this.treeRecursive(node, depth, '', (line) => { output += line + '\n'; });
    return { success: true, data: output.trim() };
  }

  private treeRecursive(
    node: AnyVFSNode,
    depth: number,
    prefix: string,
    write: (line: string) => void
  ): void {
    const icon = isDirectoryNode(node) ? '📁' : isFileNode(node) ? '📄' : '🔗';
    write(`${prefix}${icon} ${node.name}`);

    if (isDirectoryNode(node)) {
      for (let i = 0; i < node.children.length; i++) {
        const child = this.getNode(node.children[i]);
        if (!child) continue;
        const isLast = i === node.children.length - 1;
        const newPrefix = prefix + (isLast ? '    ' : '│   ');
        this.treeRecursive(child, depth + 1, newPrefix, write);
      }
    }
  }
}

// Singleton instance
export const vfs = new VirtualFS();