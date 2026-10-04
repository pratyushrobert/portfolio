import React, { useState, useEffect, useCallback } from 'react';
import { FolderOpen, Folder, File, Image, Video, FileText, ChevronRight, ChevronDown, Home, ArrowUp, ArrowLeft, ArrowRight, RefreshCw, Upload, FolderPlus, FilePlus, Eye, EyeOff, Grid, List, Search, List as ListIcon, MoreVertical, Code, FileImage, FileVideo, FileAudio, FileCode, FileJson, FileText as FileTextIcon } from 'lucide-react';
import { vfs } from '../../../lib/vfs';
import type { AnyVFSNode } from '../../../types/vfs';
import { useWindowStore } from '../../../stores/useWindowStore';
import { getAppIcon, getFileIcon } from '../../../lib/icons';
import { Icon } from '../../ui/Icon';
import './FileManagerApp.css';

interface FileManagerAppProps {
  instance: any;
}

export const FileManagerApp: React.FC<FileManagerAppProps> = ({ instance }) => {
  const { updateWindowSize, openWindowWithParams } = useWindowStore();
  const [currentPath, setCurrentPath] = useState(vfs.getCwd());
  const [entries, setEntries] = useState<AnyVFSNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showHidden, setShowHidden] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [addressBar, setAddressBar] = useState(currentPath);

  // Load directory contents
  const loadDirectory = useCallback((path: string) => {
    console.log('[FileManager] loadDirectory called with:', path);
    const result = vfs.list(path);
    console.log('[FileManager] vfs.list result:', result);
    if (result.success) {
      let items = result.data!;
      if (searchQuery) {
        items = items.filter((n) => n.name.toLowerCase().includes(searchQuery.toLowerCase()));
      }
      console.log('[FileManager] items after filter:', items.map(i => i.name));
      setEntries(items);
      setCurrentPath(path);
      setAddressBar(path);
      setSelectedId(null);
    } else {
      console.error('[FileManager] vfs.list failed:', result.error);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadDirectory(currentPath);
  }, [loadDirectory]);

  // Navigate to path
  const navigate = (path: string) => {
    loadDirectory(path);
  };

  // Go up one level
  const goUp = () => {
    if (currentPath !== '/') {
      const parent = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
      navigate(parent);
    }
  };

  // Handle entry click
  const handleEntryClick = (node: AnyVFSNode, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      setSelectedId((prev) => (prev === node.id ? null : node.id));
    } else if (e.detail === 2) {
      // Double click
      openNode(node);
    } else {
      setSelectedId(node.id);
    }
  };

  // Open node (file or directory)
  const openNode = (node: AnyVFSNode) => {
    if (node.type === 'directory') {
      navigate(vfs.resolvePath(currentPath + '/' + node.name));
    } else if (node.type === 'file') {
      openFile(node);
    }
  };

  // Open file with appropriate app
  const openFile = (node: AnyVFSNode) => {
    const mimeType = node.mimeType;
    const filePath = currentPath + '/' + node.name;
    const appId = mimeType.startsWith('image/') ? 'image-viewer' : mimeType.startsWith('video/') ? 'video-player' : mimeType === 'application/pdf' ? 'resume-viewer' : mimeType.startsWith('text/') || mimeType === 'application/json' ? 'editor' : 'terminal';
    const windowConfig = {
      id: `${appId}-${Date.now()}`,
      appId,
      title: node.name,
      icon: getAppIcon(appId, mimeType),
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 150,
      width: 800,
      height: 600,
      isMinimized: false,
      isMaximized: false,
    };

    openWindowWithParams(windowConfig, { file: node, path: filePath });
  };

  // Address bar submit
  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = vfs.setCwd(addressBar);
    if (result.success) {
      loadDirectory(addressBar);
    } else {
      setAddressBar(currentPath); // Reset on error
    }
  };

  // Get icon for file type
  const getFileIcon = (node: AnyVFSNode) => {
    if (node.type === 'directory') return <Icon icon={FolderOpen} size={24} className="file-icon folder" />;
    if (node.type === 'symlink') return <Icon icon={File} size={24} className="file-icon symlink" />;

    const IconComponent = getFileIconFromMime(node.mimeType, false);
    return <Icon icon={IconComponent} size={24} className="file-icon" />;
  };

  // Wrapper to avoid naming conflict with imported function
  const getFileIconFromMime = (mimeType: string, isDirectory: boolean) => {
    if (isDirectory) return FolderOpen;
    if (mimeType.startsWith('image/')) return Image;
    if (mimeType.startsWith('video/')) return Video;
    if (mimeType === 'application/pdf') return FileTextIcon;
    if (mimeType.startsWith('text/')) return FileTextIcon;
    if (mimeType.startsWith('audio/')) return FileAudio;
    if (mimeType === 'application/json') return FileJson;
    if (mimeType.startsWith('application/')) return FileCode;
    return File;
  };

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Sidebar shortcuts
  const sidebarItems = [
    { id: 'home', name: 'Home', path: '/home/user', icon: Home },
    { id: 'documents', name: 'Documents', path: '/home/user/Documents', icon: FileText },
    { id: 'downloads', name: 'Downloads', path: '/home/user/Downloads', icon: ArrowUp },
    { id: 'projects', name: 'Projects', path: '/home/user/projects', icon: Folder },
    { id: 'pictures', name: 'Pictures', path: '/home/user/Pictures', icon: Image },
    { id: 'videos', name: 'Videos', path: '/home/user/Videos', icon: Video },
  ];

  return (
    <div className="file-manager-app" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div className="fm-toolbar">
        <div className="fm-toolbar-left">
          <button className="fm-btn" onClick={goUp} title="Go up" disabled={currentPath === '/'}>
            <Icon icon={ArrowUp} size={16} />
          </button>
          <button className="fm-btn" onClick={() => navigate('/home/user')} title="Home">
            <Icon icon={Home} size={16} />
          </button>
        </div>
        <div className="fm-toolbar-center">
          <button className="fm-btn" onClick={() => {}} title="Back" disabled>
            <Icon icon={ArrowLeft} size={16} />
          </button>
          <button className="fm-btn" onClick={() => {}} title="Forward" disabled>
            <Icon icon={ArrowRight} size={16} />
          </button>
          <button className="fm-btn" onClick={goUp} title="Up" disabled={currentPath === '/'}>
            <Icon icon={ArrowUp} size={16} />
          </button>
          <button className="fm-btn" onClick={() => navigate('/home/user')} title="Home">
            <Icon icon={Home} size={16} />
          </button>
          <button className="fm-btn" onClick={() => loadDirectory(currentPath)} title="Refresh">
            <Icon icon={RefreshCw} size={16} />
          </button>
        </div>
        <form className="fm-address-bar" onSubmit={handleAddressSubmit}>
          <input
            type="text"
            value={addressBar}
            onChange={(e) => setAddressBar(e.target.value)}
            placeholder="Path"
            spellCheck={false}
          />
        </form>
        <div className="fm-toolbar-right">
          <button className="fm-btn" onClick={() => {}} title="Upload" disabled>
            <Icon icon={Upload} size={16} />
          </button>
          <button className="fm-btn" onClick={() => {}} title="New Folder" disabled>
            <Icon icon={FolderPlus} size={16} />
          </button>
          <button className="fm-btn" onClick={() => {}} title="New File" disabled>
            <Icon icon={FilePlus} size={16} />
          </button>
          <button className="fm-btn" onClick={() => setShowHidden(!showHidden)} title={showHidden ? 'Hide hidden files' : 'Show hidden files'}>
            {showHidden ? <Icon icon={EyeOff} size={16} /> : <Icon icon={Eye} size={16} />}
          </button>
          <button className="fm-btn" onClick={() => setSidebarOpen(!sidebarOpen)} title="Toggle sidebar">
            <Icon icon={Grid} size={16} />
          </button>
          <div className="fm-view-toggle">
            <button className={`fm-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')} title="Grid view">
              <Icon icon={Grid} size={16} />
            </button>
            <button className={`fm-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')} title="List view">
              <Icon icon={ListIcon} size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="fm-main" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="fm-sidebar">
            <div className="fm-sidebar-section">
              <h3>Places</h3>
              <ul>
                {sidebarItems.map((item) => (
                  <li key={item.id}>
                    <button
                      className={`fm-sidebar-item ${currentPath.startsWith(item.path) ? 'active' : ''}`}
                      onClick={() => navigate(item.path)}
                    >
                      <Icon icon={item.icon} size={16} className="lucide-icon" />
                      <span>{item.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="fm-sidebar-section">
              <h3>Devices</h3>
              <ul>
                <li>
                  <button className="fm-sidebar-item" onClick={() => navigate('/')}>
                    <Icon icon={File} size={16} className="lucide-icon" />
                    <span>Filesystem</span>
                  </button>
                </li>
              </ul>
            </div>
          </aside>
        )}

        {/* File List */}
        <div className={`fm-file-list ${viewMode}`}>
          {entries.length === 0 ? (
            <div className="fm-empty">
              <Icon icon={Folder} size={48} className="lucide-icon" />
              <p>This folder is empty</p>
            </div>
          ) : (
            viewMode === 'grid' ? (
              <div className="fm-grid" role="list">
                {entries.map((node) => (
                  <div
                    key={node.id}
                    className={`fm-grid-item ${selectedId === node.id ? 'selected' : ''}`}
                    onClick={(e) => handleEntryClick(node, e)}
                    onDoubleClick={() => openNode(node)}
                    role="listitem"
                    aria-selected={selectedId === node.id}
                  >
                    <div className="fm-grid-icon">{getFileIcon(node)}</div>
                    <div className="fm-grid-name" title={node.name}>{node.name}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="fm-list" role="list">
                <div className="fm-list-header">
                  <div className="fm-col-name">Name</div>
                  <div className="fm-col-size">Size</div>
                  <div className="fm-col-date">Modified</div>
                </div>
                {entries.map((node) => (
                  <div
                    key={node.id}
                    className={`fm-list-item ${selectedId === node.id ? 'selected' : ''}`}
                    onClick={(e) => handleEntryClick(node, e)}
                    onDoubleClick={() => openNode(node)}
                    role="listitem"
                    aria-selected={selectedId === node.id}
                  >
                    <div className="fm-col-name">
                      <span className="fm-list-icon">{getFileIcon(node)}</span>
                      <span>{node.name}</span>
                    </div>
                    <div className="fm-col-size">{node.type === 'file' ? formatSize(node.size) : '—'}</div>
                    <div className="fm-col-date">{formatDate(node.modifiedAt)}</div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="fm-statusbar">
        <span>{entries.length} items</span>
        {selectedId && (
          <>
            <span className="fm-separator">|</span>
            <span>1 selected</span>
          </>
        )}
      </div>
    </div>
  );
};