import {
  createFileNode,
  createDirectoryNode,
  createSymlinkNode,
  createBinaryFileNode,
  createBuiltInBinaryFileNode,
  isFileNode,
  isDirectoryNode,
  isSymlinkNode,
  updateNodeTimestamp,
} from './nodes';
import { saveToLocalStorage } from './persistence';
import { storeBinaryFile, getBinaryFile, deleteBinaryFile, generateStorageKey } from './binaryStorage';
import type {
  VFSState,
  AnyVFSNode,
  VFSOperationResult,
  VFSStatResult,
} from '../../types/vfs';

export class VirtualFS {
  private state: VFSState;
  private listeners: Set<() => void> = new Set();

  private static _instance: VirtualFS | null = null;

  private constructor() {
    // Clear localStorage to force fresh state
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('mimios-vfs');
      localStorage.removeItem('mimios-vfs-version');
    }
    console.log('[VFS] Constructor called - creating initial state');
    this.state = this.createInitialState();
    if (typeof localStorage !== 'undefined') {
      saveToLocalStorage(this.state);
    }
    console.log('[VFS] Initial state created, cwd:', this.state.cwd, 'nodes:', Object.keys(this.state.nodes).length);
  }

  static getInstance(): VirtualFS {
    if (!VirtualFS._instance) {
      VirtualFS._instance = new VirtualFS();
    }
    return VirtualFS._instance;
  }

  private createInitialState(): VFSState {
    const root = createDirectoryNode('/', null);
    const home = createDirectoryNode('home', root.id);
    const user = createDirectoryNode('pratyush', home.id);

    // Create standard directories
    const documents = createDirectoryNode('documents', user.id);
    const images = createDirectoryNode('images', user.id);
    const videos = createDirectoryNode('videos', user.id);
    const skills = createDirectoryNode('skills', user.id);
    const experience = createDirectoryNode('experience', user.id);
    const certificates = createDirectoryNode('certificates', user.id);

    // Create .mimi directory
    const mimiDir = createDirectoryNode('.mimi', user.id);
    const secretDir = createDirectoryNode('.secret', user.id);

    // Create built-in hero image
    const heroImage = createBuiltInBinaryFileNode(
      'hero.png',
      images.id,
      'image/png',
      13057, // actual file size
      '/portfolio/images/hero.png'
    );

    // Create built-in react logo
    const reactLogo = createBuiltInBinaryFileNode(
      'react.svg',
      images.id,
      'image/svg+xml',
      4126, // actual file size
      '/portfolio/images/react.svg'
    );

    // Create built-in vite logo
    const viteLogo = createBuiltInBinaryFileNode(
      'vite.svg',
      images.id,
      'image/svg+xml',
      8709, // actual file size
      '/portfolio/images/vite.svg'
    );

    // Add children to user
    user.children = [documents.id, images.id, videos.id, skills.id, experience.id, certificates.id, mimiDir.id, secretDir.id];

    // Add built-in images to images directory
    images.children = [heroImage.id, reactLogo.id, viteLogo.id];
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

    // Create resume.pdf - built-in static asset
    const resume = createBuiltInBinaryFileNode(
      'resume.pdf',
      user.id,
      'application/pdf',
      0, // size unknown for static asset
      '/portfolio/documents/resume.pdf'
    );

    // Skills file
    const skillsFile = createFileNode(
      'skills.md',
      skills.id,
      `# Skills

## Languages
- TypeScript / JavaScript
- Python
- Go
- Rust
- SQL

## Frontend
- React / Next.js
- Vue.js
- Tailwind CSS
- WebGL / Three.js

## Backend
- Node.js / Express / Fastify
- Go / Gin
- PostgreSQL / Redis
- GraphQL / REST

## Infrastructure
- Docker / Kubernetes
- AWS / GCP
- CI/CD (GitHub Actions, GitLab CI)
- Terraform

## Security
- Web Application Security
- Cryptography basics
- Network monitoring

*This is a placeholder skills list. Actual skills to be added.`
    );

    // Experience file
    const experienceFile = createFileNode(
      'experience.md',
      experience.id,
      `# Experience

## [Current/Recent Position]
**Company** — *Role*
*Dates*

- Achievement 1
- Achievement 2
- Achievement 3

## [Previous Position]
**Company** — *Role*
*Dates*

- Achievement 1
- Achievement 2

*This is a placeholder experience list. Actual experience to be added.`
    );

    // Certificates directory (empty placeholder)
    // certificates.children = [];

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

    // Create secret CTF challenge files in .secret dir
    const flagCipher = createFileNode(
      'cipher.txt',
      secretDir.id,
      `TWltaU9TcntjNHRfcDB3M3JmMWxfZzR0M3dheX0=`
    );
    const flagNote = createFileNode(
      'note.txt',
      secretDir.id,
      `Mimi's Secret Vault
To decode the cipher, use the 'base64 decode <text>' command in the terminal!
Once discovered, submit your flag with: 'challenge submit <flag>'`
    );
    secretDir.children = [flagCipher.id, flagNote.id];

    return {
      nodes: {
        [root.id]: root,
        [home.id]: home,
        [user.id]: user,
        [documents.id]: documents,
        [images.id]: images,
        [videos.id]: videos,
        [skills.id]: skills,
        [experience.id]: experience,
        [certificates.id]: certificates,
        [mimiDir.id]: mimiDir,
        [secretDir.id]: secretDir,
        [etc.id]: etc,
        [about.id]: about,
        [contact.id]: contact,
        [resume.id]: resume,
        [mimiInfo.id]: mimiInfo,
        [motd.id]: motd,
        [skillsFile.id]: skillsFile,
        [experienceFile.id]: experienceFile,
        [flagCipher.id]: flagCipher,
        [flagNote.id]: flagNote,
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
    console.log('[VFS] list called with:', path, '-> resolved:', targetPath, 'cwd:', this.state.cwd);
    const node = this.getNodeByPath(targetPath);
    console.log('[VFS] node found:', node ? {id: node.id, name: node.name, type: node.type, childrenCount: (node as any).children?.length} : 'NOT FOUND');
    if (!node || !isDirectoryNode(node)) {
      console.error('[VFS] Not a directory:', targetPath);
      return { success: false, error: 'Not a directory' };
    }
    const dirNode = node as any; // TypeScript narrowing
    const children = dirNode.children.map((id: string) => this.getNode(id)).filter(Boolean) as AnyVFSNode[];
    console.log('[VFS] children found:', children.map(c => ({name: c.name, type: c.type, mimeType: (c as any).mimeType})));
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
  ): Promise<VFSOperationResult<{ path: string; storageKey: string }>> {
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

  async cp(sourcePath: string, destPath: string): Promise<VFSOperationResult> {
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

    const copied = await this.copyNode(source, destParent.id, destName);
    destParent.children.push(copied.id);
    this.state.nodes[destParent.id] = updateNodeTimestamp(destParent);
    this.notify();
    return { success: true };
  }

  private async copyNode(node: AnyVFSNode, newParentId: string, newName: string): Promise<AnyVFSNode> {
    if (isFileNode(node)) {
      if (node.isBinary && node.storageKey) {
        // Visitor upload - copy binary data to new IndexedDB entry
        const storedFile = await getBinaryFile(node.storageKey);
        if (storedFile) {
          const newStorageKey = generateStorageKey(node.name);
          await storeBinaryFile(newStorageKey, storedFile.data, storedFile.mimeType, storedFile.name);
          const copy = createBinaryFileNode(newName, newParentId, node.mimeType, node.size, newStorageKey);
          this.state.nodes[copy.id] = copy;
          return copy;
        }
      }
      // Built-in asset or text file - preserve assetPath
      const copy = createFileNode(newName, newParentId, node.content, node.mimeType, node.isBinary, node.assetPath);
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
    srcParts.pop();
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
      result.assetPath = node.assetPath;
      result.storageKey = node.storageKey;
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
export const vfs = VirtualFS.getInstance();