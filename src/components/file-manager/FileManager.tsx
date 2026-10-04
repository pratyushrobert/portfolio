import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Move,
  Eye,
  EyeOff,
  Search,
  Grid,
  List,
  MoreVertical,
  Loader2,
  AlertCircle,
  Upload,
  X,
} from 'lucide-react';
import { vfs } from '../../lib/vfs';
import { isFileNode, isDirectoryNode } from '../../lib/vfs/nodes';
import type { AnyVFSNode } from '../../types/vfs';
import { Icon } from '../ui/Icon';
import './FileManager.css';

interface FileManagerProps {
  windowId: string;
  onOpenRequest?: (request: any) => void;
}

const HOME_PATH = '/home/pratyush';
const HIDDEN_DIRS = ['.mimi'];

export function FileManager({ windowId, onOpenRequest }: FileManagerProps) {
  const [currentPath, setCurrentPath] = useState<string>(HOME_PATH);
  const [entries, setEntries] = useState<AnyVFSNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedEntry, setSelectedEntry] = useState<AnyVFSNode | null>(null);
  const [history, setHistory] = useState<string[]>([HOME_PATH]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [newItemName, setNewItemName] = useState('');
  const [creatingItem, setCreatingItem] = useState<'file' | 'folder' | null>(null);
  const [renamingEntry, setRenamingEntry] = useState<AnyVFSNode | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [conflictFile, setConflictFile] = useState<{ file: File; existingName: string } | null>(null);
  const [conflictResolution, setConflictResolution] = useState<'replace' | 'rename' | 'cancel'>('cancel');
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  // Navigation history management
  const navigateTo = useCallback((path: string, addToHistory = true) => {
    setLoading(true);
    setError(null);
    const result = vfs.list(path);
    if (result.success) {
      let filtered = result.data!;
      if (!showHidden) {
        filtered = filtered.filter(e => !e.name.startsWith('.'));
      }
      setEntries(filtered);
      setCurrentPath(path);
      setSelectedEntry(null);
      if (addToHistory) {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(path);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
      }
    } else {
      setError(result.error || 'Failed to list directory');
      setEntries([]);
    }
    setLoading(false);
  }, [showHidden, history, historyIndex]);

  // Load directory on path change
  useEffect(() => {
    navigateTo(currentPath, false);
  }, [currentPath, showHidden]);

  const goBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      navigateTo(history[newIndex], false);
    }
  };

  const goForward = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      navigateTo(history[newIndex], false);
    }
  };

  const goUp = () => {
    if (currentPath !== '/') {
      const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
      navigateTo(parent);
    }
  };

  const goHome = () => navigateTo(HOME_PATH);

  const refresh = () => navigateTo(currentPath, false);

  // Upload handlers
  const handleFileSelect = useCallback((files: FileList) => {
    const fileArray = Array.from(files);
    // Filter valid files
    const validFiles = fileArray.filter(f => {
      if (f.size > 50 * 1024 * 1024) {
        setError(`File "${f.name}" exceeds 50 MB limit`);
        return false;
      }
      return true;
    });
    if (validFiles.length > 0) {
      setUploadFiles(validFiles);
      setUploadDialogOpen(true);
    }
  }, []);

  const handleFileInputClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  }, [handleFileSelect]);

  const handleUploadConfirm = useCallback(async () => {
    if (uploadFiles.length === 0) return;

    setLoading(true);
    setError(null);

    for (const file of uploadFiles) {
      const result = await vfs.importBinaryFile(file, `${currentPath}/${file.name}`, 'rename');
      if (!result.success) {
        setError(result.error || `Failed to import ${file.name}`);
        break;
      }
    }

    setUploadFiles([]);
    setUploadDialogOpen(false);
    setUploadProgress({});
    setLoading(false);
    refresh();
  }, [currentPath, uploadFiles]);

  const handleCancelUpload = useCallback(() => {
    setUploadFiles([]);
    setUploadDialogOpen(false);
    setUploadProgress({});
  }, []);

  const handleDoubleClick = (entry: AnyVFSNode) => {
    if (isDirectoryNode(entry)) {
      const newPath = currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`;
      navigateTo(newPath);
    } else if (isFileNode(entry)) {
      openFile(entry);
    }
  };

  const openFile = (entry: AnyVFSNode) => {
    if (!isFileNode(entry)) return;

    const fullPath = currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`;
    const ext = entry.name.split('.').pop()?.toLowerCase() || '';

    // Editable text/code files
    const editableExtensions = [
      'txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx',
      'css', 'html', 'py', 'cpp', 'c', 'java', 'go', 'sh'
    ];

    let appId: string;
    if (editableExtensions.includes(ext)) appId = 'editor';
    else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) appId = 'image-viewer';
    else if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) appId = 'video-player';
    else if (ext === 'pdf') appId = 'pdf-viewer';
    else if (['txt', 'md'].includes(ext)) appId = 'text-viewer'; // fallback for txt/md if not in editable list
    else appId = 'editor';

    if (onOpenRequest) {
      onOpenRequest({
        type: 'open',
        path: fullPath,
        appId,
        mimeType: entry.mimeType,
      });
    } else {
      // No handler - show message
      alert(`No application available for ${ext || 'this file type'}`);
    }
  };

  const createFolder = async () => {
    if (!newItemName.trim()) return;
    const fullPath = currentPath === '/' ? `/${newItemName.trim()}` : `${currentPath}/${newItemName.trim()}`;
    const result = vfs.mkdir(fullPath);
    if (result.success) {
      setNewItemName('');
      setCreatingItem(null);
      refresh();
    } else {
      setError(result.error || 'Failed to create folder');
    }
  };

  const createFile = async () => {
    if (!newItemName.trim()) return;
    const fullPath = currentPath === '/' ? `/${newItemName.trim()}` : `${currentPath}/${newItemName.trim()}`;
    const result = vfs.writeFile(fullPath, '');
    if (result.success) {
      setNewItemName('');
      setCreatingItem(null);
      refresh();
    } else {
      setError(result.error || 'Failed to create file');
    }
  };

  const deleteEntry = async (entry: AnyVFSNode) => {
    if (!confirm(`Delete "${entry.name}"?`)) return;
    const fullPath = currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`;
    const recursive = isDirectoryNode(entry) && entry.children.length > 0;
    const result = await vfs.rm(fullPath, recursive);
    if (result.success) {
      refresh();
    } else {
      setError(result.error || 'Failed to delete');
    }
  };

  const renameEntry = async (entry: AnyVFSNode) => {
    if (!renameValue.trim()) return;
    const srcPath = currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`;
    const destPath = currentPath === '/' ? `/${renameValue.trim()}` : `${currentPath}/${renameValue.trim()}`;
    const result = vfs.mv(srcPath, destPath);
    if (result.success) {
      setRenamingEntry(null);
      setRenameValue('');
      refresh();
    } else {
      setError(result.error || 'Failed to rename');
    }
  };

  const copyEntry = async (entry: AnyVFSNode) => {
    const srcPath = currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`;
    const destPath = currentPath === '/' ? `/${entry.name}_copy` : `${currentPath}/${entry.name}_copy`;
    const result = vfs.cp(srcPath, destPath);
    if (result.success) {
      refresh();
    } else {
      setError(result.error || 'Failed to copy');
    }
  };

  const startRename = (entry: AnyVFSNode) => {
    setRenamingEntry(entry);
    setRenameValue(entry.name);
    // Focus the input after state update
    setTimeout(() => fileInputRef.current?.focus(), 0);
  };

  const startCreate = (type: 'file' | 'folder') => {
    setCreatingItem(type);
    setNewItemName(type === 'folder' ? 'New Folder' : 'new-file.txt');
    setTimeout(() => fileInputRef.current?.focus(), 0);
  };

  const getEntryIcon = (entry: AnyVFSNode) => {
    if (isDirectoryNode(entry)) {
      if (entry.name === '.mimi') return <Folder className="icon folder mimi" size={24} />;
      return <Folder className="icon folder" size={24} />;
    }
    const ext = entry.name.split('.').pop()?.toLowerCase() || '';
    if (['txt', 'md'].includes(ext)) return <FileText className="icon file text" size={24} />;
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return <Image className="icon file image" size={24} />;
    if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) return <Video className="icon file video" size={24} />;
    if (ext === 'pdf') return <FileText className="icon file pdf" size={24} />;
    if (['js', 'ts', 'tsx', 'jsx', 'css', 'json', 'html'].includes(ext)) return <FileCode className="icon file code" size={24} />;
    return <File className="icon file" size={24} />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <div className="file-manager">
      {/* Toolbar */}
      <div className="fm-toolbar">
        <div className="fm-nav">
          <button className="fm-btn" onClick={goBack} disabled={historyIndex === 0} title="Back">
            <Icon icon={ChevronLeft} size={16} />
          </button>
          <button className="fm-btn" onClick={goForward} disabled={historyIndex >= history.length - 1} title="Forward">
            <Icon icon={ChevronRight} size={16} />
          </button>
          <button className="fm-btn" onClick={goUp} title="Up">
            <Icon icon={ChevronUp} size={16} />
          </button>
          <button className="fm-btn" onClick={goHome} title="Home">
            <Icon icon={Home} size={16} />
          </button>
          <button className="fm-btn" onClick={refresh} disabled={loading} title="Refresh">
            <Icon icon={RefreshCw} size={16} className={loading ? 'spinning' : ''} />
          </button>
        </div>

        <div className="fm-pathbar">
          <input
            type="text"
            value={currentPath}
            onChange={e => navigateTo(e.targetValue)}
            onKeyDown={e => e.key === 'Enter' && navigateTo(e.currentTarget.value)}
            readOnly={!false}
            className="fm-path-input"
          />
        </div>

        <div className="fm-actions">
          <button className="fm-btn" onClick={handleFileInputClick} title="Upload">
            <Icon icon={Upload} size={16} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={e => e.target.files && handleFileSelect(e.target.files)}
            style={{ display: 'none' }}
          />
          <button className="fm-btn" onClick={() => startCreate('folder')} title="New Folder">
            <Icon icon={Plus} size={16} />
          </button>
          <button className="fm-btn" onClick={() => startCreate('file')} title="New File">
            <Icon icon={File} size={16} className="icon" />
          </button>
          <label className="fm-btn toggle" title={showHidden ? 'Hide hidden files' : 'Show hidden files'}>
            <input
              type="checkbox"
              checked={showHidden}
              onChange={e => setShowHidden(e.target.checked)}
            />
            <Icon icon={Eye} size={16} className={showHidden ? 'visible' : ''} />
            <Icon icon={EyeOff} size={16} className={showHidden ? '' : 'visible'} />
          </label>
          <button className="fm-btn" onClick={() => setViewMode('grid')} title="Grid view" className={viewMode === 'grid' ? 'active' : ''}>
            <Icon icon={Grid} size={16} />
          </button>
          <button className="fm-btn" onClick={() => setViewMode('list')} title="List view" className={viewMode === 'list' ? 'active' : ''}>
            <Icon icon={List} size={16} />
          </button>
        </div>
      </div>

      {/* Error toast */}
      {error && (
        <div className="fm-error" onClick={() => setError(null)}>
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={(e) => { e.stopPropagation(); setError(null); }}>✕</button>
        </div>
      )}

      {/* File list */}
      <div className={`fm-content ${viewMode}`}>
        {loading ? (
          <div className="fm-loading"><Loader2 className="spinning" size={24} /> Loading...</div>
        ) : entries.length === 0 ? (
          <div className="fm-empty">
            <Icon icon={Folder} size={48} className="empty-icon" />
            <p>This folder is empty</p>
            <button className="fm-btn-small" onClick={() => startCreate('folder')}>
              <Icon icon={Plus} size={14} /> Create folder
            </button>
          </div>
        ) : (
          <div
            className="fm-entries"
            role="listbox"
            aria-label="Files"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {entries.map((entry, index) => {
              const isSelected = selectedEntry?.id === entry.id;
              const isRenaming = renamingEntry?.id === entry.id;
              const isHidden = entry.name.startsWith('.');

              return (
                <div
                  key={entry.id}
                  className={`fm-entry ${isSelected ? 'selected' : ''} ${isHidden ? 'hidden' : ''} ${isRenaming ? 'renaming' : ''}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => setSelectedEntry(entry)}
                  onDoubleClick={() => handleDoubleClick(entry)}
                  onContextMenu={e => { e.preventDefault(); setSelectedEntry(entry); }}
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
                        if (e.key === 'Escape') { setRenamingEntry(null); setRenameValue(''); }
                      }}
                      className="fm-rename-input"
                      autoFocus
                    />
                  ) : (
                    <>
                      <div className="fm-entry-icon" onClick={e => e.stopPropagation()}>
                        {getEntryIcon(entry)}
                      </div>
                      <div className="fm-entry-info">
                        <div className="fm-entry-name">{entry.name}</div>
                        <div className="fm-entry-meta">
                          {isFileNode(entry) && `${formatSize(entry.size)} • `}
                          {formatDate(entry.modifiedAt)}
                        </div>
                      </div>
                      <div className="fm-entry-actions">
                        <button className="fm-icon-btn" onClick={e => { e.stopPropagation(); startRename(entry); }} title="Rename">
                          <Icon icon={Edit2} size={14} />
                        </button>
                        <button className="fm-icon-btn" onClick={e => { e.stopPropagation(); copyEntry(entry); }} title="Copy">
                          <Icon icon={Copy} size={14} />
                        </button>
                        <button className="fm-icon-btn danger" onClick={e => { e.stopPropagation(); deleteEntry(entry); }} title="Delete">
                          <Icon icon={Trash2} size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Create new item inline */}
        {creatingItem && (
          <div className="fm-entry creating">
            <div className="fm-entry-icon">
              {creatingItem === 'folder' ? <Icon icon={Folder} size={24} className="icon folder" /> : <Icon icon={File} size={24} className="icon file" />}
            </div>
            <input
              ref={fileInputRef}
              type="text"
              value={newItemName}
              onChange={e => setNewItemName(e.target.value)}
              onBlur={() => creatingItem === 'folder' ? createFolder() : createFile()}
              onKeyDown={e => {
                if (e.key === 'Enter') { creatingItem === 'folder' ? createFolder() : createFile(); }
                if (e.key === 'Escape') { setCreatingItem(null); setNewItemName(''); }
              }}
              className="fm-rename-input"
              autoFocus
            />
            <div className="fm-entry-actions">
              <button className="fm-icon-btn" onClick={() => { setCreatingItem(null); setNewItemName(''); }} title="Cancel">
                <Icon icon={Trash2} size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    {uploadDialogOpen && uploadFiles.length > 0 ? (

          <div className="fm-upload-dialog-overlay" onClick={() => setUploadDialogOpen(false)}>
        <div className="fm-upload-dialog" onClick={e => e.stopPropagation()}>
          <div className="fm-upload-dialog-header">
            <h3>Upload Files</h3>
            <button className="fm-dialog-close" onClick={handleCancelUpload} title="Cancel">
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
                    <span className="fm-upload-file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                </div>
                <div className="fm-upload-progress">
                  <div className="fm-upload-progress-bar" style={{ width: `${uploadProgress[file.name] || 0}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="fm-upload-dialog-actions">
            <button className="fm-btn fm-btn-secondary" onClick={handleCancelUpload}>
              Cancel
            </button>
            <button className="fm-btn fm-btn-primary" onClick={handleUploadConfirm} disabled={loading}>
              {loading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>
      </div>
        ) : null}
    </>
  );
}
