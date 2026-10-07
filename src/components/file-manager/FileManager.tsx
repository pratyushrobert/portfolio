import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Folder,
  File,
  FileText,
  Image,
  Video,
  FileCode,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Home,
  RefreshCw,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Eye,
  EyeOff,
  Grid,
  List,
  Loader2,
  AlertCircle,
  Upload,
  X,
  ExternalLink,
  HardDrive,
  GitBranch,
  Star,
  GitFork,
  Search,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  PanelLeft,
  Link,
} from 'lucide-react';
import { vfs } from '../../lib/vfs';
import { isFileNode, isDirectoryNode } from '../../lib/vfs/nodes';
import type { AnyVFSNode } from '../../types/vfs';
import { Icon } from '../ui/Icon';
import type { DesktopOpenRequest } from '../../types/desktop';
import { projectsApi, type Project, type RemoteRepoItem, type RemoteRepoFile } from '../../lib/api/projects';
import { githubApi, type GitHubRepoSummary } from '../../lib/api/github';
import { getApiErrorMessage } from '../../lib/api/client';
import './FileManager.css';

interface FileManagerProps {
  windowId: string;
  appParams?: Record<string, unknown>;
  onOpenRequest?: (request: DesktopOpenRequest) => void;
}

const HOME_PATH = '/home/pratyush';

// Unified Navigation Location model
export type FMLocation =
  | { type: 'local'; path: string }
  | { type: 'github-list' }
  | {
      type: 'github-repo';
      repo: string;
      path: string;
      projectName?: string;
      projectId?: string;
    };

export type SortField = 'name' | 'type' | 'size' | 'date';
export type SortDirection = 'asc' | 'desc';

interface ContextMenuState {
  x: number;
  y: number;
  type: 'local-entry' | 'local-empty' | 'remote-entry' | 'remote-empty';
  localEntry?: AnyVFSNode;
  remoteItem?: RemoteRepoItem;
}

const LOCAL_PLACES = [
  { id: 'home', label: 'Home', path: HOME_PATH, icon: Home },
  { id: 'documents', label: 'Documents', path: `${HOME_PATH}/documents`, icon: FileText },
  { id: 'images', label: 'Pictures', path: `${HOME_PATH}/images`, icon: Image },
  { id: 'videos', label: 'Videos', path: `${HOME_PATH}/videos`, icon: Video },
  { id: 'skills', label: 'Skills', path: `${HOME_PATH}/skills`, icon: Folder },
  { id: 'experience', label: 'Experience', path: `${HOME_PATH}/experience`, icon: Folder },
  { id: 'certificates', label: 'Certificates', path: `${HOME_PATH}/certificates`, icon: Folder },
];

export function FileManager({ windowId: _windowId, appParams, onOpenRequest }: FileManagerProps) {
  // Initialize navigation location from appParams
  const getInitialLocation = (): FMLocation => {
    if (appParams?.mode === 'github' || appParams?.repo) {
      if (appParams.repo) {
        return {
          type: 'github-repo',
          repo: String(appParams.repo),
          path: (appParams.path as string) || '',
          projectName: (appParams.projectName as string) || undefined,
          projectId: (appParams.projectId as string) || undefined,
        };
      }
      return { type: 'github-list' };
    }
    if (appParams?.path) {
      return { type: 'local', path: String(appParams.path) };
    }
    return { type: 'local', path: HOME_PATH };
  };

  // Unified History State
  const [history, setHistory] = useState<FMLocation[]>([getInitialLocation()]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const currentLocation = useMemo(() => history[historyIndex] || { type: 'local', path: HOME_PATH }, [history, historyIndex]);

  const isLocalMode = currentLocation.type === 'local';
  const isGitHubListView = currentLocation.type === 'github-list';
  const isRemoteMode = currentLocation.type === 'github-repo';

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [pathInputVal, setPathInputVal] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  // Local VFS state
  const [localEntries, setLocalEntries] = useState<AnyVFSNode[]>([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [selectedLocalEntry, setSelectedLocalEntry] = useState<AnyVFSNode | null>(null);
  const [creatingItem, setCreatingItem] = useState<'file' | 'folder' | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [renamingEntry, setRenamingEntry] = useState<AnyVFSNode | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Remote GitHub Repository State
  const [remoteEntries, setRemoteEntries] = useState<RemoteRepoItem[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteOpeningFile, setRemoteOpeningFile] = useState<string | null>(null);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [selectedRemoteItem, setSelectedRemoteItem] = useState<RemoteRepoItem | null>(null);

  // GitHub Account Discovery State
  const [discoveredRepos, setDiscoveredRepos] = useState<GitHubRepoSummary[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);
  const [selectedRepoSummary, setSelectedRepoSummary] = useState<GitHubRepoSummary | null>(null);

  // Curated Projects List
  const [projectsList, setProjectsList] = useState<Project[]>([]);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Upload State
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);

  // Fetch projects list once on mount
  useEffect(() => {
    projectsApi.list().then(setProjectsList).catch(() => {});
  }, []);

  // Fetch discovered repos from GitHub
  const fetchDiscoveredRepos = useCallback(async (force = false) => {
    setReposLoading(true);
    setReposError(null);
    try {
      const data = await githubApi.listRepos(force);
      setDiscoveredRepos(data);
    } catch (err) {
      setReposError(getApiErrorMessage(err));
    } finally {
      setReposLoading(false);
    }
  }, []);

  // Auto-fetch repos on entering github-list view
  useEffect(() => {
    if (isGitHubListView) {
      void fetchDiscoveredRepos(false);
    }
  }, [isGitHubListView, fetchDiscoveredRepos]);

  // Navigate to a location in the unified history
  const navigateToLocation = useCallback((newLoc: FMLocation, addToHistory = true) => {
    // If navigating to /home/pratyush/github, treat as github-list
    if (newLoc.type === 'local' && (newLoc.path === `${HOME_PATH}/github` || newLoc.path === '/home/pratyush/github')) {
      newLoc = { type: 'github-list' };
    }

    setSearchQuery('');
    setSelectedLocalEntry(null);
    setSelectedRemoteItem(null);
    setSelectedRepoSummary(null);
    setIsEditingPath(false);
    setContextMenu(null);

    if (addToHistory) {
      setHistory(prev => {
        const next = prev.slice(0, historyIndex + 1);
        next.push(newLoc);
        return next;
      });
      setHistoryIndex(prev => prev + 1);
    }
  }, [historyIndex]);

  // Handle external parameter changes
  useEffect(() => {
    if (appParams?.mode === 'github' || appParams?.repo) {
      if (appParams.repo) {
        navigateToLocation({
          type: 'github-repo',
          repo: String(appParams.repo),
          path: (appParams.path as string) || '',
          projectName: (appParams.projectName as string) || undefined,
          projectId: (appParams.projectId as string) || undefined,
        });
      } else {
        navigateToLocation({ type: 'github-list' });
      }
    } else if (appParams?.path) {
      navigateToLocation({ type: 'local', path: String(appParams.path) });
    }
  }, [appParams, navigateToLocation]);

  // Load local VFS directory contents
  const loadLocalDirectory = useCallback((path: string) => {
    setLocalLoading(true);
    setLocalError(null);
    const result = vfs.list(path);
    if (result.success) {
      let filtered = result.data!;
      if (!showHidden) {
        filtered = filtered.filter(e => !e.name.startsWith('.'));
      }
      setLocalEntries(filtered);
    } else {
      setLocalError(result.error || 'Failed to list directory');
      setLocalEntries([]);
    }
    setLocalLoading(false);
  }, [showHidden]);

  // Load remote GitHub repository contents
  const loadRemoteDirectory = useCallback(async (repo: string, path: string, projectId?: string) => {
    setRemoteLoading(true);
    setRemoteError(null);
    try {
      const repoName = repo.split('/').pop() || repo;
      let items: RemoteRepoItem[];
      if (projectId) {
        items = await projectsApi.getRepositoryContents(projectId, path);
      } else {
        items = await githubApi.getRepoContents(repoName, path);
      }
      setRemoteEntries(items);
    } catch (err) {
      setRemoteError(getApiErrorMessage(err));
      setRemoteEntries([]);
    } finally {
      setRemoteLoading(false);
    }
  }, []);

  // Sync data whenever current location changes
  useEffect(() => {
    if (currentLocation.type === 'local') {
      loadLocalDirectory(currentLocation.path);
    } else if (currentLocation.type === 'github-repo') {
      void loadRemoteDirectory(currentLocation.repo, currentLocation.path, currentLocation.projectId);
    }
  }, [currentLocation, loadLocalDirectory, loadRemoteDirectory]);

  // Navigation actions
  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < history.length - 1;

  const goBack = () => {
    if (canGoBack) {
      setHistoryIndex(prev => prev - 1);
      setSearchQuery('');
      setSelectedLocalEntry(null);
      setSelectedRemoteItem(null);
      setContextMenu(null);
    }
  };

  const goForward = () => {
    if (canGoForward) {
      setHistoryIndex(prev => prev + 1);
      setSearchQuery('');
      setSelectedLocalEntry(null);
      setSelectedRemoteItem(null);
      setContextMenu(null);
    }
  };

  const goUp = () => {
    if (currentLocation.type === 'local') {
      if (currentLocation.path !== '/') {
        const parent = currentLocation.path.split('/').slice(0, -1).join('/') || '/';
        navigateToLocation({ type: 'local', path: parent });
      }
    } else if (currentLocation.type === 'github-repo') {
      if (currentLocation.path) {
        const segments = currentLocation.path.split('/').filter(Boolean);
        segments.pop();
        const parentPath = segments.join('/');
        navigateToLocation({
          type: 'github-repo',
          repo: currentLocation.repo,
          path: parentPath,
          projectName: currentLocation.projectName,
          projectId: currentLocation.projectId,
        });
      } else {
        // From repo root, go up to GitHub list
        navigateToLocation({ type: 'github-list' });
      }
    } else if (currentLocation.type === 'github-list') {
      navigateToLocation({ type: 'local', path: HOME_PATH });
    }
  };

  const goHome = () => navigateToLocation({ type: 'local', path: HOME_PATH });

  const refreshCurrentView = () => {
    if (currentLocation.type === 'local') {
      loadLocalDirectory(currentLocation.path);
    } else if (currentLocation.type === 'github-repo') {
      void loadRemoteDirectory(currentLocation.repo, currentLocation.path, currentLocation.projectId);
    } else if (currentLocation.type === 'github-list') {
      void fetchDiscoveredRepos(true);
    }
  };

  // Close context menu on global click or Escape
  useEffect(() => {
    const handleGlobalDown = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
      setSortMenuOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        setSortMenuOpen(false);
        setIsEditingPath(false);
        setCreatingItem(null);
        setRenamingEntry(null);
      }
    };

    document.addEventListener('mousedown', handleGlobalDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleGlobalDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Format size helper
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format date helper
  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '—';
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get File/Folder icon component
  const renderLocalIcon = (entry: AnyVFSNode) => {
    if (entry.name === 'github' && currentLocation.type === 'local' && currentLocation.path === HOME_PATH) {
      return <GitBranch className="icon folder" size={24} style={{ color: '#38bdf8' }} />;
    }
    if (isDirectoryNode(entry)) {
      if (entry.name === '.mimi') return <Folder className="icon folder mimi" size={24} />;
      return <Folder className="icon folder" size={24} />;
    }
    const ext = entry.name.split('.').pop()?.toLowerCase() || '';
    if (['txt', 'md'].includes(ext)) return <FileText className="icon file text" size={24} />;
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return <Image className="icon file image" size={24} />;
    if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) return <Video className="icon file video" size={24} />;
    if (ext === 'pdf') return <FileText className="icon file pdf" size={24} />;
    if (['js', 'ts', 'tsx', 'jsx', 'css', 'json', 'html', 'py', 'go', 'rs', 'c', 'cpp'].includes(ext)) {
      return <FileCode className="icon file code" size={24} />;
    }
    return <File className="icon file" size={24} />;
  };

  const renderRemoteIcon = (item: RemoteRepoItem) => {
    if (item.type === 'dir') {
      return <Folder className="icon folder" size={24} />;
    }
    const ext = item.name.split('.').pop()?.toLowerCase() || '';
    if (['txt', 'md', 'markdown'].includes(ext)) return <FileText className="icon file text" size={24} />;
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return <Image className="icon file image" size={24} />;
    if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) return <Video className="icon file video" size={24} />;
    if (ext === 'pdf') return <FileText className="icon file pdf" size={24} />;
    if (['js', 'ts', 'tsx', 'jsx', 'css', 'scss', 'json', 'html', 'py', 'go', 'rs', 'c', 'cpp', 'h', 'java', 'sh', 'bash', 'yaml', 'yml', 'xml', 'sql'].includes(ext)) {
      return <FileCode className="icon file code" size={24} />;
    }
    return <File className="icon file" size={24} />;
  };

  // Local File Opening
  const openLocalFile = (entry: AnyVFSNode) => {
    if (!isFileNode(entry)) return;
    const fullPath = currentLocation.type === 'local'
      ? (currentLocation.path === '/' ? `/${entry.name}` : `${currentLocation.path}/${entry.name}`)
      : `/${entry.name}`;

    const ext = entry.name.split('.').pop()?.toLowerCase() || '';
    const editableExtensions = [
      'txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx',
      'css', 'html', 'py', 'cpp', 'c', 'java', 'go', 'sh', 'sql', 'yaml', 'yml'
    ];

    let appId: string;
    if (editableExtensions.includes(ext)) appId = 'editor';
    else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) appId = 'image-viewer';
    else if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) appId = 'video-player';
    else if (ext === 'pdf') appId = 'pdf-viewer';
    else if (['txt', 'md'].includes(ext)) appId = 'text-viewer';
    else appId = 'editor';

    if (onOpenRequest) {
      onOpenRequest({
        type: 'open',
        path: fullPath,
        appId,
        mimeType: entry.mimeType,
      });
    }
  };

  // Remote File Previewing
  const previewRemoteFile = async (item: RemoteRepoItem) => {
    if (currentLocation.type !== 'github-repo') return;
    const { repo, projectId } = currentLocation;

    if (item.size > 1024 * 1024) {
      if (onOpenRequest) {
        onOpenRequest({
          type: 'open',
          appId: 'text-viewer',
          title: `${item.name} (${repo})`,
          params: {
            isRemote: true,
            isOversized: true,
            size: item.size,
            path: item.path,
            htmlUrl: item.html_url,
          },
        });
      } else {
        window.open(item.html_url, '_blank', 'noopener,noreferrer');
      }
      return;
    }

    setRemoteOpeningFile(item.path);
    setRemoteError(null);
    try {
      const repoName = repo.split('/').pop() || repo;
      let fileData: RemoteRepoFile;
      if (projectId) {
        fileData = await projectsApi.getRepositoryFile(projectId, item.path);
      } else {
        fileData = await githubApi.getRepoFile(repoName, item.path);
      }
      const ext = item.name.split('.').pop()?.toLowerCase() || '';

      if (fileData.isBinary) {
        const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
        if (imageExtensions.includes(ext)) {
          if (onOpenRequest) {
            onOpenRequest({
              type: 'open',
              appId: 'image-viewer',
              title: `${item.name} (${repo})`,
              mimeType: ext === 'svg' ? 'image/svg+xml' : 'image/png',
              params: {
                isRemote: true,
                imageSrc: fileData.content,
                title: item.name,
                path: item.path,
                htmlUrl: fileData.html_url,
              },
            });
          } else {
            window.open(fileData.html_url, '_blank', 'noopener,noreferrer');
          }
        } else if (ext === 'pdf') {
          if (onOpenRequest) {
            onOpenRequest({
              type: 'open',
              appId: 'pdf-viewer',
              title: `${item.name} (${repo})`,
              mimeType: 'application/pdf',
              params: {
                isRemote: true,
                pdfSrc: fileData.content,
                title: item.name,
                path: item.path,
                htmlUrl: fileData.html_url,
              },
            });
          } else {
            window.open(fileData.html_url, '_blank', 'noopener,noreferrer');
          }
        } else {
          // Unsupported binary preview
          if (onOpenRequest) {
            onOpenRequest({
              type: 'open',
              appId: 'text-viewer',
              title: `${item.name} (${repo})`,
              params: {
                isRemote: true,
                isBinary: true,
                title: item.name,
                path: item.path,
                htmlUrl: fileData.html_url,
                size: item.size,
              },
            });
          } else {
            window.open(fileData.html_url, '_blank', 'noopener,noreferrer');
          }
        }
      } else {
        if (onOpenRequest) {
          onOpenRequest({
            type: 'open',
            appId: 'text-viewer',
            title: `${item.name} (${repo})`,
            params: {
              isRemote: true,
              remoteContent: fileData.content,
              projectId: projectId || undefined,
              repo: repo || undefined,
              path: item.path,
              htmlUrl: fileData.html_url,
            },
          });
        } else {
          window.open(fileData.html_url, '_blank', 'noopener,noreferrer');
        }
      }
    } catch (err) {
      setRemoteError(getApiErrorMessage(err));
    } finally {
      setRemoteOpeningFile(null);
    }
  };

  // Local file operations
  const createFolder = () => {
    if (!newItemName.trim() || currentLocation.type !== 'local') return;
    const fullPath = currentLocation.path === '/'
      ? `/${newItemName.trim()}`
      : `${currentLocation.path}/${newItemName.trim()}`;
    const result = vfs.mkdir(fullPath);
    if (result.success) {
      setNewItemName('');
      setCreatingItem(null);
      refreshCurrentView();
    } else {
      setLocalError(result.error || 'Failed to create folder');
    }
  };

  const createFile = () => {
    if (!newItemName.trim() || currentLocation.type !== 'local') return;
    const fullPath = currentLocation.path === '/'
      ? `/${newItemName.trim()}`
      : `${currentLocation.path}/${newItemName.trim()}`;
    const result = vfs.writeFile(fullPath, '');
    if (result.success) {
      setNewItemName('');
      setCreatingItem(null);
      refreshCurrentView();
    } else {
      setLocalError(result.error || 'Failed to create file');
    }
  };

  const deleteEntry = async (entry: AnyVFSNode) => {
    if (currentLocation.type !== 'local') return;
    if (!confirm(`Delete "${entry.name}"?`)) return;
    const fullPath = currentLocation.path === '/'
      ? `/${entry.name}`
      : `${currentLocation.path}/${entry.name}`;
    const recursive = isDirectoryNode(entry) && entry.children.length > 0;
    const result = await vfs.rm(fullPath, recursive);
    if (result.success) {
      refreshCurrentView();
    } else {
      setLocalError(result.error || 'Failed to delete');
    }
  };

  const renameEntry = (entry: AnyVFSNode) => {
    if (!renameValue.trim() || currentLocation.type !== 'local') return;
    const srcPath = currentLocation.path === '/'
      ? `/${entry.name}`
      : `${currentLocation.path}/${entry.name}`;
    const destPath = currentLocation.path === '/'
      ? `/${renameValue.trim()}`
      : `${currentLocation.path}/${renameValue.trim()}`;
    const result = vfs.mv(srcPath, destPath);
    if (result.success) {
      setRenamingEntry(null);
      setRenameValue('');
      refreshCurrentView();
    } else {
      setLocalError(result.error || 'Failed to rename');
    }
  };

  const copyEntry = async (entry: AnyVFSNode) => {
    if (currentLocation.type !== 'local') return;
    const srcPath = currentLocation.path === '/'
      ? `/${entry.name}`
      : `${currentLocation.path}/${entry.name}`;
    const destPath = currentLocation.path === '/'
      ? `/${entry.name}_copy`
      : `${currentLocation.path}/${entry.name}_copy`;
    const result = await vfs.cp(srcPath, destPath);
    if (result.success) {
      refreshCurrentView();
    } else {
      setLocalError(result.error || 'Failed to copy');
    }
  };

  // Upload handlers
  const handleFileSelect = (files: FileList) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(f => {
      if (f.size > 50 * 1024 * 1024) {
        setLocalError(`File "${f.name}" exceeds 50 MB limit`);
        return false;
      }
      return true;
    });
    if (validFiles.length > 0) {
      setUploadFiles(validFiles);
      setUploadDialogOpen(true);
    }
  };

  const handleUploadConfirm = async () => {
    if (uploadFiles.length === 0 || currentLocation.type !== 'local') return;
    setLocalLoading(true);
    setLocalError(null);

    for (const file of uploadFiles) {
      const destPath = currentLocation.path === '/'
        ? `/${file.name}`
        : `${currentLocation.path}/${file.name}`;
      const result = await vfs.importBinaryFile(file, destPath, 'rename');
      if (!result.success) {
        setLocalError(result.error || `Failed to import ${file.name}`);
        break;
      }
    }

    setUploadFiles([]);
    setUploadDialogOpen(false);
    setLocalLoading(false);
    refreshCurrentView();
  };

  // Sorting function
  const sortItems = <T extends { name: string; type: string; size?: number; modifiedAt?: number }>(items: T[]): T[] => {
    return [...items].sort((a, b) => {
      const isDirA = a.type === 'directory' || a.type === 'dir';
      const isDirB = b.type === 'directory' || b.type === 'dir';

      if (isDirA !== isDirB) {
        return isDirA ? -1 : 1; // Folders always first
      }

      let diff = 0;
      if (sortBy === 'name') {
        diff = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      } else if (sortBy === 'size') {
        diff = (a.size || 0) - (b.size || 0);
      } else if (sortBy === 'date') {
        diff = (a.modifiedAt || 0) - (b.modifiedAt || 0);
      } else if (sortBy === 'type') {
        const extA = a.name.split('.').pop() || '';
        const extB = b.name.split('.').pop() || '';
        diff = extA.localeCompare(extB);
      }

      return sortDirection === 'asc' ? diff : -diff;
    });
  };

  const handleSortToggle = (field: SortField) => {
    if (sortBy === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
    setSortMenuOpen(false);
  };

  // Local entries calculation (including Virtual GitHub folder at HOME)
  let displayedLocalEntries: AnyVFSNode[] = [];
  if (isLocalMode) {
    let source = localEntries;
    if (currentLocation.path === HOME_PATH) {
      source = [
        {
          id: 'virtual-github-folder-id',
          name: 'github',
          type: 'directory' as const,
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          children: [],
        } as unknown as AnyVFSNode,
        ...localEntries.filter(e => e.name !== 'github' && e.name.toLowerCase() !== 'projects'),
      ];
    } else {
      source = localEntries.filter(e => e.name.toLowerCase() !== 'projects');
    }

    // Search filter in local mode
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      // If user is searching locally, run search across current directory
      displayedLocalEntries = source.filter(e => e.name.toLowerCase().includes(q));
    } else {
      displayedLocalEntries = source;
    }

    displayedLocalEntries = sortItems(displayedLocalEntries);
  }

  // Remote entries calculation
  let displayedRemoteEntries: RemoteRepoItem[] = [];
  if (isRemoteMode) {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      displayedRemoteEntries = remoteEntries.filter(item => item.name.toLowerCase().includes(q));
    } else {
      displayedRemoteEntries = remoteEntries;
    }
    displayedRemoteEntries = sortItems(displayedRemoteEntries);
  }

  // Filtered discovered GitHub repositories
  const filteredRepos = discoveredRepos.filter(repo => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchName = repo.name.toLowerCase().includes(q);
    const matchDesc = (repo.description || '').toLowerCase().includes(q);
    const matchLang = (repo.language || '').toLowerCase().includes(q);
    const matchTopic = repo.topics.some(t => t.toLowerCase().includes(q));
    return matchName || matchDesc || matchLang || matchTopic;
  });

  // Current active project matching (for banner)
  const currentLocalProject = isLocalMode
    ? projectsList.find(p => {
        if (!p.github_repo) return false;
        const cleanCurrent = currentLocation.path.toLowerCase();
        const slug = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const repoEnd = (p.github_repo.toLowerCase().split('/').pop() || '').replace(/[^a-z0-9]/g, '');
        return (
          cleanCurrent.endsWith(`/${slug}`) ||
          cleanCurrent.endsWith(`/${repoEnd}`) ||
          cleanCurrent.endsWith(`/${p.name.toLowerCase()}`)
        );
      })
    : null;

  return (
    <div className="file-manager" role="application" aria-label="MimiOS File Manager">
      {/* Toolbar */}
      <div className="fm-toolbar">
        {/* Navigation Controls */}
        <div className="fm-nav">
          <button
            className="fm-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          >
            <Icon icon={PanelLeft} size={16} />
          </button>
          <button
            className="fm-btn"
            onClick={goBack}
            disabled={!canGoBack}
            title="Back"
            aria-label="Go back"
          >
            <Icon icon={ChevronLeft} size={16} />
          </button>
          <button
            className="fm-btn"
            onClick={goForward}
            disabled={!canGoForward}
            title="Forward"
            aria-label="Go forward"
          >
            <Icon icon={ChevronRight} size={16} />
          </button>
          <button
            className="fm-btn"
            onClick={goUp}
            title="Up"
            aria-label="Go up one level"
          >
            <Icon icon={ChevronUp} size={16} />
          </button>
          <button
            className={`fm-btn ${isLocalMode && currentLocation.path === HOME_PATH ? 'active' : ''}`}
            onClick={goHome}
            title="Local Home"
            aria-label="Go to local home directory"
          >
            <Icon icon={Home} size={16} />
          </button>
          <button
            className={`fm-btn ${isGitHubListView ? 'active' : ''}`}
            onClick={() => navigateToLocation({ type: 'github-list' })}
            title="GitHub Repositories (@pratyushrobert)"
            aria-label="View public GitHub repositories"
          >
            <Icon icon={GitBranch} size={16} />
          </button>
          <button
            className="fm-btn"
            onClick={refreshCurrentView}
            disabled={localLoading || remoteLoading || reposLoading}
            title="Refresh"
            aria-label="Refresh directory contents"
          >
            <Icon
              icon={RefreshCw}
              size={16}
              className={localLoading || remoteLoading || reposLoading ? 'spinning' : ''}
            />
          </button>
        </div>

        {/* Breadcrumb Path Bar */}
        <div className="fm-pathbar">
          {isEditingPath ? (
            <input
              type="text"
              value={pathInputVal}
              onChange={e => setPathInputVal(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  navigateToLocation({ type: 'local', path: pathInputVal.trim() || HOME_PATH });
                  setIsEditingPath(false);
                } else if (e.key === 'Escape') {
                  setIsEditingPath(false);
                }
              }}
              onBlur={() => setIsEditingPath(false)}
              className="fm-path-input"
              autoFocus
            />
          ) : (
            <div
              className="fm-breadcrumbs"
              onDoubleClick={() => {
                if (isLocalMode) {
                  setPathInputVal(currentLocation.path);
                  setIsEditingPath(true);
                }
              }}
            >
              {isLocalMode && (
                <>
                  <span
                    className={`fm-breadcrumb-item ${currentLocation.path === HOME_PATH ? 'active' : ''}`}
                    onClick={() => navigateToLocation({ type: 'local', path: HOME_PATH })}
                    title="Home"
                  >
                    <Home size={12} />
                    <span>Home</span>
                  </span>
                  {currentLocation.path.startsWith(HOME_PATH + '/') &&
                    currentLocation.path
                      .slice(HOME_PATH.length + 1)
                      .split('/')
                      .map((seg, idx, arr) => {
                        const target = `${HOME_PATH}/${arr.slice(0, idx + 1).join('/')}`;
                        const isLast = idx === arr.length - 1;
                        return (
                          <React.Fragment key={target}>
                            <span className="fm-breadcrumb-separator">/</span>
                            <span
                              className={`fm-breadcrumb-item ${isLast ? 'active' : ''}`}
                              onClick={() => navigateToLocation({ type: 'local', path: target })}
                            >
                              {seg}
                            </span>
                          </React.Fragment>
                        );
                      })}
                  {!currentLocation.path.startsWith(HOME_PATH) &&
                    currentLocation.path
                      .split('/')
                      .filter(Boolean)
                      .map((seg, idx, arr) => {
                        const target = `/${arr.slice(0, idx + 1).join('/')}`;
                        const isLast = idx === arr.length - 1;
                        return (
                          <React.Fragment key={target}>
                            <span className="fm-breadcrumb-separator">/</span>
                            <span
                              className={`fm-breadcrumb-item ${isLast ? 'active' : ''}`}
                              onClick={() => navigateToLocation({ type: 'local', path: target })}
                            >
                              {seg}
                            </span>
                          </React.Fragment>
                        );
                      })}
                </>
              )}

              {isGitHubListView && (
                <>
                  <span
                    className="fm-breadcrumb-item"
                    onClick={() => navigateToLocation({ type: 'local', path: HOME_PATH })}
                    title="Local Home"
                  >
                    <Home size={12} />
                    <span>Home</span>
                  </span>
                  <span className="fm-breadcrumb-separator">/</span>
                  <span className="fm-breadcrumb-item active" title="Public Repositories">
                    <GitBranch size={12} style={{ color: '#38bdf8' }} />
                    <span>GitHub Repositories (@pratyushrobert)</span>
                  </span>
                </>
              )}

              {isRemoteMode && (
                <>
                  <span
                    className="fm-breadcrumb-item"
                    onClick={() => navigateToLocation({ type: 'local', path: HOME_PATH })}
                    title="Local Home"
                  >
                    <Home size={12} />
                    <span>Home</span>
                  </span>
                  <span className="fm-breadcrumb-separator">/</span>
                  <span
                    className="fm-breadcrumb-item"
                    onClick={() => navigateToLocation({ type: 'github-list' })}
                    title="All Repositories"
                  >
                    <GitBranch size={12} style={{ color: '#38bdf8' }} />
                    <span>GitHub</span>
                  </span>
                  <span className="fm-breadcrumb-separator">/</span>
                  <span
                    className={`fm-breadcrumb-item ${!currentLocation.path ? 'active' : ''}`}
                    onClick={() =>
                      navigateToLocation({
                        type: 'github-repo',
                        repo: currentLocation.repo,
                        path: '',
                        projectName: currentLocation.projectName,
                        projectId: currentLocation.projectId,
                      })
                    }
                    title="Repository Root"
                  >
                    {currentLocation.projectName || currentLocation.repo.split('/').pop()}
                  </span>
                  {currentLocation.path
                    .split('/')
                    .filter(Boolean)
                    .map((seg, idx, arr) => {
                      const subPath = arr.slice(0, idx + 1).join('/');
                      const isLast = idx === arr.length - 1;
                      return (
                        <React.Fragment key={subPath}>
                          <span className="fm-breadcrumb-separator">/</span>
                          <span
                            className={`fm-breadcrumb-item ${isLast ? 'active' : ''}`}
                            onClick={() =>
                              navigateToLocation({
                                type: 'github-repo',
                                repo: currentLocation.repo,
                                path: subPath,
                                projectName: currentLocation.projectName,
                                projectId: currentLocation.projectId,
                              })
                            }
                          >
                            {seg}
                          </span>
                        </React.Fragment>
                      );
                    })}
                </>
              )}
              {isRemoteMode && (
                <span className="fm-readonly-pill" title="Remote GitHub repository (Read-Only in MimiOS)">
                  <GitBranch size={11} /> Read-Only
                </span>
              )}
            </div>
          )}
        </div>

        {/* Search Bar */}
        <div className="fm-search-box">
          <Search size={14} className="fm-search-icon" />
          <input
            type="text"
            className="fm-search-input"
            placeholder={
              isLocalMode
                ? 'Search files...'
                : isGitHubListView
                ? 'Search repos...'
                : 'Search directory...'
            }
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="fm-icon-btn" onClick={() => setSearchQuery('')} title="Clear search">
              <X size={12} />
            </button>
          )}
        </div>

        {/* View and Sorting Actions */}
        <div className="fm-actions">
          {isLocalMode && (
            <>
              {currentLocalProject?.github_repo && (
                <button
                  className="fm-btn"
                  onClick={() =>
                    navigateToLocation({
                      type: 'github-repo',
                      repo: currentLocalProject.github_repo!,
                      path: '',
                      projectName: currentLocalProject.name,
                      projectId: currentLocalProject.id,
                    })
                  }
                  title={`Browse remote repository (${currentLocalProject.github_repo})`}
                  aria-label={`Browse remote repository (${currentLocalProject.github_repo})`}
                >
                  <Icon icon={GitBranch} size={15} />
                </button>
              )}
              <button
                className="fm-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Upload Files"
                aria-label="Upload files"
              >
                <Icon icon={Upload} size={16} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={e => e.target.files && handleFileSelect(e.target.files)}
                style={{ display: 'none' }}
              />
              <button
                className="fm-btn"
                onClick={() => {
                  setCreatingItem('folder');
                  setNewItemName('New Folder');
                }}
                title="New Folder"
                aria-label="Create new folder"
              >
                <Icon icon={Plus} size={16} />
              </button>
              <button
                className="fm-btn"
                onClick={() => {
                  setCreatingItem('file');
                  setNewItemName('new-file.txt');
                }}
                title="New File"
                aria-label="Create new file"
              >
                <Icon icon={File} size={16} />
              </button>
              <label
                className="fm-btn toggle"
                title={showHidden ? 'Hide hidden files' : 'Show hidden files'}
                aria-label={showHidden ? 'Hide hidden files' : 'Show hidden files'}
              >
                <input
                  type="checkbox"
                  checked={showHidden}
                  onChange={e => setShowHidden(e.target.checked)}
                />
                <Icon icon={Eye} size={16} className={showHidden ? 'visible' : ''} />
                <Icon icon={EyeOff} size={16} className={showHidden ? '' : 'visible'} />
              </label>
            </>
          )}

          {isRemoteMode && (
            <a
              href={`https://github.com/${currentLocation.repo}${currentLocation.path ? `/tree/main/${currentLocation.path}` : ''}`}
              target="_blank"
              rel="noopener noreferrer"
              className="fm-btn"
              title="Open location on GitHub"
              aria-label="Open location on GitHub"
            >
              <Icon icon={ExternalLink} size={15} />
            </a>
          )}

          {/* Sort Controls */}
          {!isGitHubListView && (
            <div className="fm-sort-wrapper">
              <button
                className={`fm-btn ${sortMenuOpen ? 'active' : ''}`}
                onClick={e => {
                  e.stopPropagation();
                  setSortMenuOpen(!sortMenuOpen);
                }}
                title={`Sort by ${sortBy} (${sortDirection})`}
                aria-label={`Sort items by ${sortBy}`}
              >
                <Icon icon={ArrowUpDown} size={15} />
              </button>
              {sortMenuOpen && (
                <div className="fm-sort-menu" onClick={e => e.stopPropagation()}>
                  <div className="fm-sort-title">Sort By</div>
                  <button
                    className={`fm-sort-item ${sortBy === 'name' ? 'active' : ''}`}
                    onClick={() => handleSortToggle('name')}
                  >
                    <span>Name</span>
                    {sortBy === 'name' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </button>
                  <button
                    className={`fm-sort-item ${sortBy === 'type' ? 'active' : ''}`}
                    onClick={() => handleSortToggle('type')}
                  >
                    <span>Type</span>
                    {sortBy === 'type' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </button>
                  <button
                    className={`fm-sort-item ${sortBy === 'size' ? 'active' : ''}`}
                    onClick={() => handleSortToggle('size')}
                  >
                    <span>Size</span>
                    {sortBy === 'size' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </button>
                  {isLocalMode && (
                    <button
                      className={`fm-sort-item ${sortBy === 'date' ? 'active' : ''}`}
                      onClick={() => handleSortToggle('date')}
                    >
                      <span>Modified Date</span>
                      {sortBy === 'date' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {!isGitHubListView && (
            <>
              <button
                className={`fm-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid view"
                aria-label="Switch to grid view"
              >
                <Icon icon={Grid} size={16} />
              </button>
              <button
                className={`fm-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="List view"
                aria-label="Switch to list view"
              >
                <Icon icon={List} size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {(localError || remoteError || reposError) && (
        <div
          className="fm-error"
          onClick={() => {
            setLocalError(null);
            setRemoteError(null);
            setReposError(null);
          }}
        >
          <AlertCircle size={16} />
          <span>{localError || remoteError || reposError}</span>
          <button
            onClick={e => {
              e.stopPropagation();
              setLocalError(null);
              setRemoteError(null);
              setReposError(null);
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Body with Sidebar and Main View */}
      <div className="fm-body">
        {/* Left Places Sidebar */}
        {sidebarOpen && (
          <aside className="fm-sidebar" aria-label="Locations">
            <div className="fm-sidebar-section">
              <div className="fm-sidebar-title">MimiOS Places</div>
              {LOCAL_PLACES.map(place => {
                const isActive = isLocalMode && currentLocation.path === place.path;
                const PlaceIcon = place.icon;
                return (
                  <button
                    key={place.id}
                    className={`fm-sidebar-item ${isActive ? 'active' : ''}`}
                    onClick={() => navigateToLocation({ type: 'local', path: place.path })}
                  >
                    <PlaceIcon size={14} className="fm-sidebar-icon" />
                    <span>{place.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="fm-sidebar-section">
              <div className="fm-sidebar-title">GitHub (Remote)</div>
              <button
                className={`fm-sidebar-item ${isGitHubListView ? 'active' : ''}`}
                onClick={() => navigateToLocation({ type: 'github-list' })}
              >
                <GitBranch size={14} style={{ color: '#38bdf8' }} />
                <span>All Repositories</span>
                {discoveredRepos.length > 0 && (
                  <span className="fm-sidebar-badge">{discoveredRepos.length}</span>
                )}
              </button>

              {projectsList
                .filter(p => p.github_repo)
                .slice(0, 5)
                .map(p => {
                  const isActive = isRemoteMode && currentLocation.repo === p.github_repo;
                  return (
                    <button
                      key={p.id}
                      className={`fm-sidebar-item ${isActive ? 'active' : ''}`}
                      onClick={() =>
                        navigateToLocation({
                          type: 'github-repo',
                          repo: p.github_repo!,
                          path: '',
                          projectName: p.name,
                          projectId: p.id,
                        })
                      }
                      title={`Browse repository ${p.name}`}
                    >
                      <Folder size={14} style={{ color: '#f59e0b' }} />
                      <span className="fm-sidebar-item-label">{p.name}</span>
                      <span className="fm-sidebar-star" title="Curated Portfolio Project">★</span>
                    </button>
                  );
                })}
            </div>
          </aside>
        )}

        {/* Main Content Area */}
        <main
          className={`fm-content ${isGitHubListView ? 'github' : viewMode}`}
          onContextMenu={e => {
            // Context menu on empty area
            const target = e.target as HTMLElement;
            if (!target.closest('.fm-entry') && !target.closest('.fm-repo-card')) {
              e.preventDefault();
              if (isLocalMode) {
                setContextMenu({ x: e.clientX, y: e.clientY, type: 'local-empty' });
              } else if (isRemoteMode) {
                setContextMenu({ x: e.clientX, y: e.clientY, type: 'remote-empty' });
              }
            }
          }}
        >
          {/* View 1: GitHub Account Discovery Repositories */}
          {isGitHubListView ? (
            <div className="fm-github-view">
              <div className="fm-github-toolbar">
                <div className="fm-github-title-group">
                  <GitBranch size={16} style={{ color: '#38bdf8' }} />
                  <span className="fm-github-title">Public Repositories</span>
                  <span className="fm-github-count">
                    {filteredRepos.length} {filteredRepos.length === 1 ? 'repository' : 'repositories'}
                  </span>
                </div>
              </div>

              {reposLoading ? (
                <div className="fm-loading">
                  <Loader2 className="spinning" size={24} /> Discovering repositories from GitHub...
                </div>
              ) : reposError && discoveredRepos.length === 0 ? (
                <div className="fm-empty">
                  <AlertCircle size={40} style={{ color: '#ef4444' }} />
                  <p>{reposError}</p>
                  <button
                    className="fm-btn-small fm-btn-accent"
                    onClick={() => void fetchDiscoveredRepos(true)}
                  >
                    Retry
                  </button>
                </div>
              ) : filteredRepos.length === 0 ? (
                <div className="fm-empty">
                  <Icon icon={Folder} size={48} className="empty-icon" />
                  <p>
                    {searchQuery
                      ? `No repositories matching "${searchQuery}"`
                      : 'No public repositories found'}
                  </p>
                </div>
              ) : (
                <div className="fm-repo-grid">
                  {filteredRepos.map(repo => {
                    const matchedProject = projectsList.find(
                      p => p.github_repo === repo.full_name || p.github_repo === repo.name
                    );
                    return (
                      <div
                        key={repo.id}
                        className={`fm-repo-card ${selectedRepoSummary?.id === repo.id ? 'selected' : ''}`}
                        onClick={() => setSelectedRepoSummary(repo)}
                        onDoubleClick={() =>
                          navigateToLocation({
                            type: 'github-repo',
                            repo: repo.full_name,
                            path: '',
                            projectName: matchedProject?.name || repo.name,
                            projectId: matchedProject?.id,
                          })
                        }
                        title={`Double-click to browse ${repo.name}`}
                      >
                        <div className="fm-repo-card-header">
                          <span className="fm-repo-card-name">
                            <GitBranch size={14} />
                            {repo.name}
                          </span>
                          <div className="fm-repo-badges">
                            {matchedProject && (
                              <span className="fm-curated-badge" title="Curated Portfolio Project in MimiOS">
                                ★ Curated
                              </span>
                            )}
                            {repo.archived && (
                              <span className="fm-archived-badge" title="Archived on GitHub">
                                Archived
                              </span>
                            )}
                          </div>
                        </div>

                        {repo.description && <p className="fm-repo-desc">{repo.description}</p>}

                        <div className="fm-repo-meta">
                          {repo.language && (
                            <span className="fm-repo-meta-item">
                              <span
                                style={{
                                  display: 'inline-block',
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  background: '#38bdf8',
                                }}
                              />
                              {repo.language}
                            </span>
                          )}
                          {repo.stargazers_count > 0 && (
                            <span className="fm-repo-meta-item">
                              <Star size={11} /> {repo.stargazers_count}
                            </span>
                          )}
                          {repo.forks_count > 0 && (
                            <span className="fm-repo-meta-item">
                              <GitFork size={11} /> {repo.forks_count}
                            </span>
                          )}
                        </div>

                        {repo.topics.length > 0 && (
                          <div className="fm-repo-topics">
                            {repo.topics.slice(0, 3).map(topic => (
                              <span key={topic} className="fm-repo-topic-tag">
                                #{topic}
                              </span>
                            ))}
                            {repo.topics.length > 3 && (
                              <span className="fm-repo-topic-tag">+{repo.topics.length - 3}</span>
                            )}
                          </div>
                        )}

                        <div className="fm-repo-actions" onClick={e => e.stopPropagation()}>
                          <button
                            className="fm-repo-action-btn fm-repo-action-primary"
                            onClick={() =>
                              navigateToLocation({
                                type: 'github-repo',
                                repo: repo.full_name,
                                path: '',
                                projectName: matchedProject?.name || repo.name,
                                projectId: matchedProject?.id,
                              })
                            }
                            title="Browse repository tree inside MimiOS"
                          >
                            <Folder size={12} />
                            <span>Browse</span>
                          </button>
                          <a
                            href={repo.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="fm-repo-action-btn"
                            title="Open repository on GitHub"
                          >
                            <ExternalLink size={12} />
                            <span>GitHub ↗</span>
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : isRemoteMode ? (
            /* View 2: Remote GitHub Repository Tree */
            remoteLoading ? (
              <div className="fm-loading">
                <Loader2 className="spinning" size={24} /> Loading repository tree...
              </div>
            ) : remoteOpeningFile ? (
              <div className="fm-loading">
                <Loader2 className="spinning" size={24} /> Opening {remoteOpeningFile}...
              </div>
            ) : displayedRemoteEntries.length === 0 ? (
              <div className="fm-empty">
                <Icon icon={Folder} size={48} className="empty-icon" />
                <p>
                  {searchQuery
                    ? `No files matching "${searchQuery}" in this directory`
                    : 'This directory is empty'}
                </p>
                <a
                  href={`https://github.com/${currentLocation.repo}${currentLocation.path ? `/tree/main/${currentLocation.path}` : ''}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="fm-btn-small"
                  style={{ marginTop: 8 }}
                >
                  <ExternalLink size={12} />
                  <span>Open directory on GitHub ↗</span>
                </a>
              </div>
            ) : (
              <div className="fm-entries" role="listbox" aria-label="Remote Files">
                {viewMode === 'list' && (
                  <div className="fm-list-header">
                    <div className="fm-list-col fm-col-name" onClick={() => handleSortToggle('name')}>
                      <span>Name</span>
                      {sortBy === 'name' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                    </div>
                    <div className="fm-list-col fm-col-type" onClick={() => handleSortToggle('type')}>
                      <span>Type</span>
                      {sortBy === 'type' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                    </div>
                    <div className="fm-list-col fm-col-size" onClick={() => handleSortToggle('size')}>
                      <span>Size</span>
                      {sortBy === 'size' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                    </div>
                  </div>
                )}
                {displayedRemoteEntries.map(item => {
                  const isSelected = selectedRemoteItem?.path === item.path;
                  return (
                    <div
                      key={item.path}
                      className={`fm-entry ${isSelected ? 'selected' : ''}`}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => setSelectedRemoteItem(item)}
                      onDoubleClick={() => {
                        if (item.type === 'dir') {
                          navigateToLocation({
                            type: 'github-repo',
                            repo: currentLocation.repo,
                            path: item.path,
                            projectName: currentLocation.projectName,
                            projectId: currentLocation.projectId,
                          });
                        } else {
                          void previewRemoteFile(item);
                        }
                      }}
                      onContextMenu={e => {
                        e.preventDefault();
                        setSelectedRemoteItem(item);
                        setContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          type: 'remote-entry',
                          remoteItem: item,
                        });
                      }}
                      title={`${item.name} (${item.type === 'dir' ? 'Folder' : formatSize(item.size)})`}
                    >
                      <div className="fm-entry-icon" onClick={e => e.stopPropagation()}>
                        {renderRemoteIcon(item)}
                      </div>
                      <div className="fm-entry-info">
                        <div className="fm-entry-name">{item.name}</div>
                        <div className="fm-entry-meta">
                          {item.type === 'dir' ? 'Directory' : formatSize(item.size)}
                        </div>
                      </div>
                      {viewMode === 'list' && (
                        <>
                          <div className="fm-list-cell fm-col-type">
                            {item.type === 'dir' ? 'Folder' : (item.name.split('.').pop()?.toUpperCase() || 'File')}
                          </div>
                          <div className="fm-list-cell fm-col-size">
                            {item.type === 'dir' ? '—' : formatSize(item.size)}
                          </div>
                        </>
                      )}
                      <div className="fm-entry-actions" onClick={e => e.stopPropagation()}>
                        <a
                          href={item.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="fm-icon-btn"
                          title="Open on GitHub ↗"
                        >
                          <ExternalLink size={13} />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* View 3: Local VirtualFS Files */
            localLoading ? (
              <div className="fm-loading">
                <Loader2 className="spinning" size={24} /> Loading folder...
              </div>
            ) : displayedLocalEntries.length === 0 ? (
              <div className="fm-empty">
                <Icon icon={Folder} size={48} className="empty-icon" />
                <p>
                  {searchQuery
                    ? `No files matching "${searchQuery}" in this folder`
                    : 'This folder is empty'}
                </p>
                {!searchQuery && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      className="fm-btn-small"
                      onClick={() => {
                        setCreatingItem('folder');
                        setNewItemName('New Folder');
                      }}
                    >
                      <Plus size={14} /> Create Folder
                    </button>
                    <button
                      className="fm-btn-small"
                      onClick={() => {
                        setCreatingItem('file');
                        setNewItemName('new-file.txt');
                      }}
                    >
                      <File size={14} /> Create File
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div
                className={`fm-entries ${dragOver ? 'drag-over' : ''}`}
                role="listbox"
                aria-label="Files"
                onDragOver={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOver(true);
                }}
                onDragLeave={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOver(false);
                }}
                onDrop={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOver(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleFileSelect(e.dataTransfer.files);
                  }
                }}
              >
                {viewMode === 'list' && (
                  <div className="fm-list-header">
                    <div className="fm-list-col fm-col-name" onClick={() => handleSortToggle('name')}>
                      <span>Name</span>
                      {sortBy === 'name' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                    </div>
                    <div className="fm-list-col fm-col-type" onClick={() => handleSortToggle('type')}>
                      <span>Type</span>
                      {sortBy === 'type' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                    </div>
                    <div className="fm-list-col fm-col-size" onClick={() => handleSortToggle('size')}>
                      <span>Size</span>
                      {sortBy === 'size' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                    </div>
                    <div className="fm-list-col fm-col-date" onClick={() => handleSortToggle('date')}>
                      <span>Modified</span>
                      {sortBy === 'date' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                    </div>
                  </div>
                )}
                {displayedLocalEntries.map(entry => {
                  const isSelected = selectedLocalEntry?.id === entry.id;
                  const isRenaming = renamingEntry?.id === entry.id;
                  const isHidden = entry.name.startsWith('.');
                  const isVirtual = entry.name === 'github' && currentLocation.path === HOME_PATH;

                  return (
                    <div
                      key={entry.id}
                      className={`fm-entry ${isSelected ? 'selected' : ''} ${isHidden ? 'hidden' : ''} ${isRenaming ? 'renaming' : ''}`}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => setSelectedLocalEntry(entry)}
                      onDoubleClick={() => {
                        if (isVirtual) {
                          navigateToLocation({ type: 'github-list' });
                        } else if (isDirectoryNode(entry)) {
                          const newPath = currentLocation.path === '/'
                            ? `/${entry.name}`
                            : `${currentLocation.path}/${entry.name}`;
                          navigateToLocation({ type: 'local', path: newPath });
                        } else if (isFileNode(entry)) {
                          openLocalFile(entry);
                        }
                      }}
                      onContextMenu={e => {
                        e.preventDefault();
                        setSelectedLocalEntry(entry);
                        setContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          type: 'local-entry',
                          localEntry: entry,
                        });
                      }}
                    >
                      {isRenaming ? (
                        <input
                          ref={fileInputRef}
                          type="text"
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onBlur={() => renameEntry(entry)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') renameEntry(entry);
                            if (e.key === 'Escape') {
                              setRenamingEntry(null);
                              setRenameValue('');
                            }
                          }}
                          className="fm-rename-input"
                          autoFocus
                        />
                      ) : (
                        <>
                          <div className="fm-entry-icon" onClick={e => e.stopPropagation()}>
                            {renderLocalIcon(entry)}
                          </div>
                          <div className="fm-entry-info">
                            <div className="fm-entry-name">{entry.name}</div>
                            <div className="fm-entry-meta">
                              {isVirtual ? (
                                'GitHub Repositories • Remote'
                              ) : (
                                <>
                                  {isFileNode(entry) && `${formatSize(entry.size)} • `}
                                  {formatDate(entry.modifiedAt)}
                                </>
                              )}
                            </div>
                          </div>
                          {viewMode === 'list' && (
                            <>
                              <div className="fm-list-cell fm-col-type">
                                {isVirtual
                                  ? 'Remote Link'
                                  : isDirectoryNode(entry)
                                  ? 'Folder'
                                  : entry.name.split('.').pop()?.toUpperCase() || 'File'}
                              </div>
                              <div className="fm-list-cell fm-col-size">
                                {isFileNode(entry) ? formatSize(entry.size) : '—'}
                              </div>
                              <div className="fm-list-cell fm-col-date">
                                {formatDate(entry.modifiedAt)}
                              </div>
                            </>
                          )}
                          {!isVirtual && (
                            <div className="fm-entry-actions" onClick={e => e.stopPropagation()}>
                              <button
                                className="fm-icon-btn"
                                onClick={() => {
                                  setRenamingEntry(entry);
                                  setRenameValue(entry.name);
                                }}
                                title="Rename"
                              >
                                <Icon icon={Edit2} size={13} />
                              </button>
                              <button
                                className="fm-icon-btn"
                                onClick={() => void copyEntry(entry)}
                                title="Copy"
                              >
                                <Icon icon={Copy} size={13} />
                              </button>
                              <button
                                className="fm-icon-btn danger"
                                onClick={() => void deleteEntry(entry)}
                                title="Delete"
                              >
                                <Icon icon={Trash2} size={13} />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* Inline Create Input */}
          {isLocalMode && creatingItem && (
            <div className="fm-entry creating">
              <div className="fm-entry-icon">
                {creatingItem === 'folder' ? (
                  <Icon icon={Folder} size={24} className="icon folder" />
                ) : (
                  <Icon icon={File} size={24} className="icon file" />
                )}
              </div>
              <input
                ref={fileInputRef}
                type="text"
                value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
                onBlur={() => (creatingItem === 'folder' ? createFolder() : createFile())}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    if (creatingItem === 'folder') {
                      createFolder();
                    } else {
                      createFile();
                    }
                  }
                  if (e.key === 'Escape') {
                    setCreatingItem(null);
                    setNewItemName('');
                  }
                }}
                className="fm-rename-input"
                autoFocus
              />
              <div className="fm-entry-actions">
                <button
                  className="fm-icon-btn"
                  onClick={() => {
                    setCreatingItem(null);
                    setNewItemName('');
                  }}
                  title="Cancel"
                >
                  <Icon icon={Trash2} size={14} />
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Status Bar */}
      <footer className="fm-statusbar">
        <span className="fm-status-info">
          {isRemoteMode ? (
            remoteLoading ? (
              'Loading remote tree...'
            ) : (
              `${displayedRemoteEntries.length} ${displayedRemoteEntries.length === 1 ? 'item' : 'items'}${selectedRemoteItem ? ` • 1 selected (${formatSize(selectedRemoteItem.size)})` : ''}`
            )
          ) : isGitHubListView ? (
            reposLoading ? (
              'Discovering public repositories from GitHub...'
            ) : (
              `${filteredRepos.length} ${filteredRepos.length === 1 ? 'repository' : 'repositories'} • @pratyushrobert`
            )
          ) : localLoading ? (
            'Loading...'
          ) : (
            `${displayedLocalEntries.length} ${displayedLocalEntries.length === 1 ? 'item' : 'items'}${selectedLocalEntry ? ` • 1 selected${isFileNode(selectedLocalEntry) ? ` (${formatSize(selectedLocalEntry.size)})` : ''}` : ''}`
          )}
        </span>
        <span className="fm-status-mode">
          {isRemoteMode ? (
            <>
              <GitBranch size={12} />
              <span>GitHub: {currentLocation.repo} • Read-Only</span>
            </>
          ) : isGitHubListView ? (
            <>
              <GitBranch size={12} />
              <span>GitHub Account Discovery • Read-Only</span>
            </>
          ) : (
            <>
              <HardDrive size={12} />
              <span>Local VirtualFS</span>
            </>
          )}
        </span>
      </footer>

      {/* Context Menu Overlay */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fm-context-menu"
          style={{
            left: `${Math.min(contextMenu.x, window.innerWidth - 210)}px`,
            top: `${Math.min(contextMenu.y, window.innerHeight - 200)}px`,
          }}
          role="menu"
        >
          {contextMenu.type === 'local-entry' && contextMenu.localEntry && (
            <>
              <button
                className="fm-context-item"
                onClick={() => {
                  const entry = contextMenu.localEntry!;
                  setContextMenu(null);
                  const currPath = currentLocation.type === 'local' ? currentLocation.path : HOME_PATH;
                  if (entry.name === 'github' && currPath === HOME_PATH) {
                    navigateToLocation({ type: 'github-list' });
                  } else if (isDirectoryNode(entry)) {
                    navigateToLocation({
                      type: 'local',
                      path: `${currPath}/${entry.name}`,
                    });
                  } else {
                    openLocalFile(entry);
                  }
                }}
              >
                <Icon icon={Folder} size={14} />
                <span>Open</span>
              </button>
              {contextMenu.localEntry.name !== 'github' && (
                <>
                  <div className="fm-context-separator" />
                  <button
                    className="fm-context-item"
                    onClick={() => {
                      const entry = contextMenu.localEntry!;
                      setContextMenu(null);
                      setRenamingEntry(entry);
                      setRenameValue(entry.name);
                    }}
                  >
                    <Icon icon={Edit2} size={14} />
                    <span>Rename</span>
                  </button>
                  <button
                    className="fm-context-item"
                    onClick={() => {
                      const entry = contextMenu.localEntry!;
                      setContextMenu(null);
                      void copyEntry(entry);
                    }}
                  >
                    <Icon icon={Copy} size={14} />
                    <span>Make a Copy</span>
                  </button>
                  <div className="fm-context-separator" />
                  <button
                    className="fm-context-item danger"
                    onClick={() => {
                      const entry = contextMenu.localEntry!;
                      setContextMenu(null);
                      void deleteEntry(entry);
                    }}
                  >
                    <Icon icon={Trash2} size={14} />
                    <span>Delete</span>
                  </button>
                </>
              )}
            </>
          )}

          {contextMenu.type === 'local-empty' && (
            <>
              <button
                className="fm-context-item"
                onClick={() => {
                  setContextMenu(null);
                  setCreatingItem('folder');
                  setNewItemName('New Folder');
                }}
              >
                <Icon icon={Folder} size={14} />
                <span>New Folder</span>
              </button>
              <button
                className="fm-context-item"
                onClick={() => {
                  setContextMenu(null);
                  setCreatingItem('file');
                  setNewItemName('new-file.txt');
                }}
              >
                <Icon icon={File} size={14} />
                <span>New File</span>
              </button>
              <div className="fm-context-separator" />
              <button
                className="fm-context-item"
                onClick={() => {
                  setContextMenu(null);
                  fileInputRef.current?.click();
                }}
              >
                <Icon icon={Upload} size={14} />
                <span>Upload Files...</span>
              </button>
              <button
                className="fm-context-item"
                onClick={() => {
                  setContextMenu(null);
                  refreshCurrentView();
                }}
              >
                <Icon icon={RefreshCw} size={14} />
                <span>Refresh</span>
              </button>
            </>
          )}

          {contextMenu.type === 'remote-entry' && contextMenu.remoteItem && (
            <>
              {contextMenu.remoteItem.type === 'dir' ? (
                <button
                  className="fm-context-item"
                  onClick={() => {
                    const item = contextMenu.remoteItem!;
                    setContextMenu(null);
                    navigateToLocation({
                      type: 'github-repo',
                      repo: (currentLocation as { repo: string }).repo,
                      path: item.path,
                      projectName: (currentLocation as { projectName?: string }).projectName,
                      projectId: (currentLocation as { projectId?: string }).projectId,
                    });
                  }}
                >
                  <Icon icon={Folder} size={14} />
                  <span>Open Folder</span>
                </button>
              ) : (
                <button
                  className="fm-context-item"
                  onClick={() => {
                    const item = contextMenu.remoteItem!;
                    setContextMenu(null);
                    void previewRemoteFile(item);
                  }}
                >
                  <Icon icon={Eye} size={14} />
                  <span>Preview in MimiOS</span>
                </button>
              )}
              <div className="fm-context-separator" />
              <a
                href={contextMenu.remoteItem.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="fm-context-item"
                onClick={() => setContextMenu(null)}
              >
                <ExternalLink size={14} />
                <span>Open on GitHub ↗</span>
              </a>
              <button
                className="fm-context-item"
                onClick={() => {
                  navigator.clipboard.writeText(contextMenu.remoteItem!.html_url).catch(() => {});
                  setContextMenu(null);
                }}
              >
                <Link size={14} />
                <span>Copy GitHub Link</span>
              </button>
            </>
          )}

          {contextMenu.type === 'remote-empty' && (
            <>
              <button
                className="fm-context-item"
                onClick={() => {
                  setContextMenu(null);
                  refreshCurrentView();
                }}
              >
                <Icon icon={RefreshCw} size={14} />
                <span>Refresh Directory</span>
              </button>
              <div className="fm-context-separator" />
              <a
                href={`https://github.com/${(currentLocation as { repo: string }).repo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="fm-context-item"
                onClick={() => setContextMenu(null)}
              >
                <ExternalLink size={14} />
                <span>Open Repository on GitHub ↗</span>
              </a>
            </>
          )}
        </div>
      )}

      {/* Upload Dialog for local files */}
      {uploadDialogOpen && uploadFiles.length > 0 && (
        <div className="fm-upload-dialog-overlay" onClick={() => setUploadDialogOpen(false)}>
          <div className="fm-upload-dialog" onClick={e => e.stopPropagation()}>
            <div className="fm-upload-dialog-header">
              <h3>Upload Files</h3>
              <button
                className="fm-dialog-close"
                onClick={() => {
                  setUploadFiles([]);
                  setUploadDialogOpen(false);
                }}
                title="Cancel"
              >
                <Icon icon={X} size={18} />
              </button>
            </div>
            <div className="fm-upload-dialog-files">
              {uploadFiles.map((file, index) => (
                <div key={index} className="fm-upload-file">
                  <div className="fm-upload-file-info">
                    <Icon icon={File} className="fm-upload-icon" size={20} />
                    <div className="fm-upload-file-details">
                      <span className="fm-upload-file-name">{file.name}</span>
                      <span className="fm-upload-file-size">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="fm-upload-dialog-actions">
              <button
                className="fm-btn fm-btn-secondary"
                onClick={() => {
                  setUploadFiles([]);
                  setUploadDialogOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                className="fm-btn fm-btn-primary"
                onClick={handleUploadConfirm}
                disabled={localLoading}
              >
                {localLoading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
