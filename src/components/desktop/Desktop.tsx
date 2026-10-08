import { useState, useEffect } from 'react';
import { TopPanel } from './TopPanel';
import { DesktopIcons } from './DesktopIcons';
import { DesktopContextMenu } from './DesktopContextMenu';
import { LiquidGlassClock } from '../ui/LiquidGlassClock';
import { WindowContainer } from '../window/Window';
import { WindowErrorBoundary } from '../window/WindowErrorBoundary';
import { useWindowStore } from '../../stores/useWindowStore';
import { useDesktopStore } from '../../stores/useDesktopStore';
import { Terminal } from '../terminal/Terminal';
import { FileManager } from '../file-manager/FileManager';
import { TextViewer } from '../text-viewer/TextViewer';
import { Editor } from '../editor/Editor';
import { ImageViewer } from '../image-viewer/ImageViewer';
import { VideoPlayer } from '../video-player/VideoPlayer';
import { PDFViewer } from '../pdf-viewer/PDFViewer';
import { AdminLogin } from '../admin/AdminLogin';
import { AdminPortal } from '../admin/AdminPortal';
import { Settings } from '../settings/Settings';
import {
  ProjectsApp,
  ProjectViewer,
  SkillsApp,
  ExperienceApp,
  CertificatesApp,
  AboutApp,
  ContactApp,
} from '../portfolio';
import { SnakeGame } from '../game/SnakeGame';
import { getAppIcon } from '../../lib/icons';
import type { DesktopOpenRequest, DesktopIcon } from '../../types/desktop';
import './Desktop.css';

export function Desktop() {
  const { windows, openWindowWithParams, focusWindow, restoreWindow } = useWindowStore();
  const icons = useDesktopStore(state => state.icons);
  const panelPosition = useDesktopStore(state => state.panelPosition);
  const snapIconsToGrid = useDesktopStore(state => state.snapIconsToGrid);
  const arrangeIcons = useDesktopStore(state => state.arrangeIcons);
  const resetIconPosition = useDesktopStore(state => state.resetIconPosition);

  const [selectedIconId, setSelectedIconId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    targetIcon?: DesktopIcon | null;
  } | null>(null);

  const handleOpenRequest = (request: DesktopOpenRequest) => {
    // Handle open requests from terminal commands and file manager
    if (request.type === 'open' && request.appId) {
      const windowId = `${request.appId}-${Date.now()}`;
      const params: Record<string, unknown> = request.params ? { ...request.params } : (request.path ? { path: request.path } : {});
      if (request.path) {
        params.path = request.path;
      }
      openWindowWithParams(
        {
          id: windowId,
          appId: request.appId,
          title: request.title || request.path?.split('/').pop() || request.appId,
          icon: getAppIcon(request.appId, request.mimeType),
          x: 100 + Math.random() * 200,
          y: 100 + Math.random() * 150,
          width: request.appId === 'snake' ? 440 : 800,
          height: request.appId === 'snake' ? 520 : 600,
          isMinimized: false,
          isMaximized: false,
        },
        Object.keys(params).length > 0 ? params : undefined
      );
    }
  };

  useEffect(() => {
    const handleCustomOpen = (e: Event) => {
      const customEvent = e as CustomEvent<DesktopOpenRequest>;
      if (customEvent.detail) {
        handleOpenRequest(customEvent.detail);
      }
    };
    window.addEventListener('mimios-open-request', handleCustomOpen);
    return () => window.removeEventListener('mimios-open-request', handleCustomOpen);
  }, []);

  const handleOpenApp = (appId: string, params?: Record<string, unknown>) => {
    setContextMenu(null);
    const existing = windows.find(w => w.appId === appId);
    if (existing) {
      if (existing.isMinimized) {
        restoreWindow(existing.id);
      }
      focusWindow(existing.id);
      return;
    }
    const icon = icons.find(i => i.appId === appId);
    const title = appId === 'resume' ? 'Resume' : icon?.label || (appId.charAt(0).toUpperCase() + appId.slice(1));
    const effectiveParams = appId === 'resume' && !params ? { path: '/home/pratyush/resume.pdf' } : params;
    openWindowWithParams(
      {
        id: `${appId}-${Date.now()}`,
        appId,
        title,
        icon: getAppIcon(appId),
        x: 100 + Math.random() * 150,
        y: 80 + Math.random() * 100,
        width: appId === 'settings' ? 760 : appId === 'snake' ? 440 : 800,
        height: appId === 'settings' ? 520 : appId === 'snake' ? 520 : 600,
        isMinimized: false,
        isMaximized: false,
      },
      effectiveParams
    );
  };

  const handleChangeWallpaper = () => {
    setContextMenu(null);
    const existing = windows.find(w => w.appId === 'settings');
    if (existing) {
      if (existing.isMinimized) {
        restoreWindow(existing.id);
      }
      focusWindow(existing.id);
      return;
    }
    openWindowWithParams(
      {
        id: `settings-${Date.now()}`,
        appId: 'settings',
        title: 'Settings',
        icon: getAppIcon('settings'),
        x: 120,
        y: 100,
        width: 760,
        height: 520,
        isMinimized: false,
        isMaximized: false,
      },
      { tab: 'appearance' }
    );
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // Do NOT hijack right-clicks inside open windows, top panel, or app launcher
    if (
      target.closest('.window-container') ||
      target.closest('.desktop-panel') ||
      target.closest('.app-launcher')
    ) {
      return;
    }

    e.preventDefault();

    // Check if right-clicked directly on a desktop icon
    const iconEl = target.closest('.desktop-icon') as HTMLElement | null;
    const iconId = iconEl?.getAttribute('data-icon-id');
    const clickedIcon = iconId ? icons.find(i => i.id === iconId) : null;

    if (clickedIcon) {
      setSelectedIconId(clickedIcon.id);
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        targetIcon: clickedIcon,
      });
    } else {
      setSelectedIconId(null);
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        targetIcon: null,
      });
    }
  };

  const handleDesktopPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    // Clicking empty desktop surface clears selection and context menu
    if (
      !target.closest('.desktop-icon') &&
      !target.closest('.desktop-context-menu') &&
      !target.closest('.window-container') &&
      !target.closest('.desktop-panel') &&
      !target.closest('.app-launcher')
    ) {
      setSelectedIconId(null);
      setContextMenu(null);
    }
  };

  const handleIconDoubleClick = (id: string) => {
    const icon = icons.find(i => i.id === id);
    if (!icon) return;
    handleOpenApp(icon.appId);
  };

  return (
    <div
      className="desktop"
      role="application"
      aria-label="MimiOS Desktop"
      onContextMenu={handleContextMenu}
      onPointerDown={handleDesktopPointerDown}
    >
      <LiquidGlassClock className={`desktop-glass-clock position-${panelPosition}`} />
      <TopPanel />
      <DesktopIcons
        selectedId={selectedIconId}
        onSelect={setSelectedIconId}
        onDoubleClick={handleIconDoubleClick}
        onContextMenuIcon={(icon, e) => {
          setSelectedIconId(icon.id);
          setContextMenu({
            x: e.clientX,
            y: e.clientY,
            targetIcon: icon,
          });
        }}
      />
      <div id="window-layer" className="window-layer">
        {windows.map(window => (
          <WindowContainer key={window.id} window={window}>
            <WindowErrorBoundary windowId={window.id} windowTitle={window.title}>
              <WindowContent appId={window.appId} windowId={window.id} appParams={window.appParams} onOpenRequest={handleOpenRequest} />
            </WindowErrorBoundary>
          </WindowContainer>
        ))}
      </div>
      {contextMenu && (
        <DesktopContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          targetIcon={contextMenu.targetIcon}
          onClose={() => setContextMenu(null)}
          onRefresh={() => {
            setContextMenu(null);
            setSelectedIconId(null);
            snapIconsToGrid();
          }}
          onArrangeIcons={() => {
            setContextMenu(null);
            setSelectedIconId(null);
            arrangeIcons();
          }}
          onOpenApp={handleOpenApp}
          onChangeWallpaper={handleChangeWallpaper}
          onResetIconPosition={(iconId) => {
            setContextMenu(null);
            resetIconPosition(iconId);
          }}
        />
      )}
    </div>
  );
}

function WindowContent({ appId, windowId, appParams, onOpenRequest }: { appId: string; windowId: string; appParams?: Record<string, unknown>; onOpenRequest?: (request: DesktopOpenRequest) => void }) {
  switch (appId) {
    case 'terminal':
      return <Terminal windowId={windowId} appParams={appParams} onOpenRequest={onOpenRequest} />;
    case 'files':
      return <FileManager windowId={windowId} appParams={appParams} onOpenRequest={onOpenRequest} />;
    case 'text-viewer':
      return <TextViewer windowId={windowId} filePath={appParams?.path as string} onOpenRequest={onOpenRequest} />;
    case 'editor':
      return <Editor windowId={windowId} filePath={appParams?.path as string} onOpenRequest={onOpenRequest} />;
    case 'image-viewer':
      return <ImageViewer windowId={windowId} filePath={appParams?.path as string} onOpenRequest={onOpenRequest} />;
    case 'video-player':
      return <VideoPlayer windowId={windowId} filePath={appParams?.path as string} onOpenRequest={onOpenRequest} />;
    case 'pdf-viewer':
    case 'resume-viewer':
    case 'resume':
      return <PDFViewer windowId={windowId} filePath={(appParams?.path as string) || '/home/pratyush/resume.pdf'} onOpenRequest={onOpenRequest} />;
    case 'projects':
      return <ProjectsApp windowId={windowId} onOpenRequest={onOpenRequest} />;
    case 'project-viewer':
      return <ProjectViewer windowId={windowId} appParams={appParams} onOpenRequest={onOpenRequest} />;
    case 'skills':
      return <SkillsApp windowId={windowId} />;
    case 'experience':
      return <ExperienceApp windowId={windowId} />;
    case 'certificates':
      return <CertificatesApp windowId={windowId} onOpenRequest={onOpenRequest} />;
    case 'about':
      return <AboutApp windowId={windowId} onOpenRequest={onOpenRequest} />;
    case 'contact':
      return <ContactApp windowId={windowId} />;
    case 'admin-login':
      return <AdminLogin windowId={windowId} />;
    case 'admin-portal':
      return <AdminPortal windowId={windowId} />;
    case 'settings':
      return <Settings windowId={windowId} appParams={appParams} onOpenRequest={onOpenRequest} />;
    case 'snake':
      return <SnakeGame />;
    default:
      return <GenericApp windowId={windowId} appId={appId} />;
  }
}

function GenericApp({ windowId: _windowId, appId }: { windowId: string; appId: string }) {
  return (
    <div className="app-placeholder generic" style={{ height: '100%', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <h3>{appId}</h3>
      <p className="placeholder-hint">Application not yet implemented</p>
    </div>
  );
}