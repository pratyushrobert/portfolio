import React, { useState, useEffect, useCallback } from 'react';
import { Folder, File, Image, Video, FileText, ChevronRight, ChevronDown, Home, ArrowUp, Search, Grid, List, MoreVertical } from 'lucide-react';
import { vfs } from '../../../lib/vfs';
import type { AnyVFSNode } from '../../../types/vfs';
import { useWindowStore } from '../../../hooks/useWindows';
import './FileManagerApp.css';

interface FileManagerAppProps {
  instance: any;
}

export const FileManagerApp: React.FC<FileManagerAppProps> = ({ instance }) => {
  const { updateWindowSize } = useWindowStore();
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
    const result = vfs.list(path);
    if (result.success) {
      let items = result.data!;
      if (searchQuery) {
        items = items.filter((n) => n.name.toLowerCase().includes(searchQuery.toLowerCase()));
      }
      setEntries(items);
      setCurrentPath(path);
      setAddressBar(path);
      setSelectedId(null);
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
    const { openWindow } = useWindowStore.getState();
    const mimeType = node.mimeType;

    if (mimeType.startsWith('image/')) {
      openWindow('image-viewer', { file: node, path: currentPath + '/' + node.name });
    } else if (mimeType.startsWith('video/')) {
      openWindow('video-player', { file: node, path: currentPath + '/' + node.name });
    } else if (mimeType === 'application/pdf') {
      openWindow('resume-viewer', { file: node, path: currentPath + '/' + node.name });
    } else if (mimeType.startsWith('text/') || mimeType === 'application/json') {
      openWindow('terminal');
      // Could cat the file in terminal
    } else {
      // Default to terminal cat
      openWindow('terminal');
    }
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
    if (node.type === 'directory') return <Folder className="file-icon folder" size={24} />;
    if (node.type === 'symlink') return <File className="file-icon symlink" size={24} />;

    const mime = node.mimeType;
    if (mime.startsWith('image/')) return <Image className="file-icon image" size={24} />;
    if (mime.startsWith('video/')) return <Video className="file-icon video" size={24} />;
    if (mime === 'application/pdf') return <FileText className="file-icon pdf" size={24} />;
    if (mime.startsWith('text/')) return <FileText className="file-icon text" size={24} />;
    return <File className="file-icon" size={24} />;
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
            <ArrowUp size={16} />
          </button>
          <button className="fm-btn" onClick={() => navigate('/home/user')} title="Home">
            <Home size={16} />
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
          <button className="fm-btn" onClick={() => setSidebarOpen(!sidebarOpen)} title="Toggle sidebar">
            <Grid size={16} />
          </button>
          <div className="fm-view-toggle">
            <button className={`fm-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')} title="Grid view">
              <Grid size={16} />
            </button>
            <button className={`fm-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')} title="List view">
              <List size={16} />
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
                      <item.icon className="lucide-icon" size={16} />
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
                    <File className="lucide-icon" size={16} />
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
              <Folder className="lucide-icon" size={48} />
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