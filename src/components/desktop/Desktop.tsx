import { Wallpaper } from './Wallpaper';
import { TopPanel } from './TopPanel';
import { DesktopIcons } from './DesktopIcons';
import { WindowContainer } from '../window/Window';
import { useWindowStore } from '../../stores/useWindowStore';
import { Terminal } from '../terminal/Terminal';
import { FileManager } from '../file-manager/FileManager';
import { TextViewer } from '../text-viewer/TextViewer';
import { Editor } from '../editor/Editor';
import { ImageViewer } from '../image-viewer/ImageViewer';
import './Desktop.css';

export function Desktop() {
  const { windows, openWindowWithParams } = useWindowStore();
  const openWindows = windows.filter(w => !w.isMinimized);

  const handleOpenRequest = (request: any) => {
    // Handle open requests from terminal commands and file manager
    if (request.type === 'open' && request.appId) {
      const windowId = `${request.appId}-${Date.now()}`;
      openWindowWithParams(
        {
          id: windowId,
          appId: request.appId,
          title: request.path?.split('/').pop() || request.appId,
          icon: () => null,
          x: 100 + Math.random() * 200,
          y: 100 + Math.random() * 150,
          width: 800,
          height: 600,
          isMinimized: false,
          isMaximized: false,
        },
        request.path ? { path: request.path } : undefined
      );
    }
  };

  return (
    <div className="desktop" role="application" aria-label="MimiOS Desktop">
      <Wallpaper />
      <TopPanel />
      <DesktopIcons />
      <div id="window-layer" className="window-layer">
        {openWindows.map(window => (
          <WindowContainer key={window.id} window={window}>
            <WindowContent appId={window.appId} windowId={window.id} appParams={window.appParams} onOpenRequest={handleOpenRequest} />
          </WindowContainer>
        ))}
      </div>
    </div>
  );
}

function WindowContent({ appId, windowId, appParams, onOpenRequest }: { appId: string; windowId: string; appParams?: Record<string, unknown>; onOpenRequest?: (request: any) => void }) {
  switch (appId) {
    case 'terminal':
      return <Terminal windowId={windowId} onOpenRequest={onOpenRequest} />;
    case 'files':
      return <FileManager windowId={windowId} onOpenRequest={onOpenRequest} />;
    case 'text-viewer':
      return <TextViewer windowId={windowId} filePath={appParams?.path as string} onOpenRequest={onOpenRequest} />;
    case 'editor':
      return <Editor windowId={windowId} filePath={appParams?.path as string} onOpenRequest={onOpenRequest} />;
    case 'image-viewer':
      return <ImageViewer windowId={windowId} filePath={appParams?.path as string} onOpenRequest={onOpenRequest} />;
    case 'settings':
      return <SettingsPlaceholder windowId={windowId} />;
    default:
      return <GenericApp windowId={windowId} appId={appId} />;
  }
}

function FilesPlaceholder({ windowId }: { windowId: string }) {
  return (
    <div className="app-placeholder files" style={{ height: '100%', padding: 16 }}>
      <h3>Files</h3>
      <p className="placeholder-hint">File manager coming soon...</p>
      <div className="mock-files">
        <div className="mock-file">📁 Documents</div>
        <div className="mock-file">📁 Downloads</div>
        <div className="mock-file">📁 Pictures</div>
        <div className="mock-file">📄 README.md</div>
        <div className="mock-file">📄 package.json</div>
      </div>
    </div>
  );
}

function EditorPlaceholder({ windowId }: { windowId: string }) {
  return (
    <div className="app-placeholder editor" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="placeholder-header">
        <span>Editor</span>
        <span className="placeholder-hint">Code editor coming soon...</span>
      </div>
      <pre className="editor-content" style={{ flex: 1, margin: 0, padding: 16, overflow: 'auto' }}>
{`// Welcome to PratyushOS Editor
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

console.log(greet("World"));`}
      </pre>
    </div>
  );
}

function SettingsPlaceholder({ windowId }: { windowId: string }) {
  return (
    <div className="app-placeholder settings" style={{ height: '100%', padding: 24 }}>
      <h2>Settings</h2>
      <div className="settings-section">
        <h3>Appearance</h3>
        <label className="setting-row">
          <span>Wallpaper</span>
          <input type="file" accept="image/*" />
        </label>
        <label className="setting-row">
          <span>Theme</span>
          <select>
            <option>System</option>
            <option>Light</option>
            <option>Dark</option>
          </select>
        </label>
      </div>
      <div className="settings-section">
        <h3>Desktop</h3>
        <label className="setting-row">
          <span>Show Panel</span>
          <input type="checkbox" defaultChecked />
        </label>
        <label className="setting-row">
          <span>Panel Position</span>
          <select>
            <option>Top</option>
            <option>Bottom</option>
          </select>
        </label>
      </div>
    </div>
  );
}

function GenericApp({ windowId, appId }: { windowId: string; appId: string }) {
  return (
    <div className="app-placeholder generic" style={{ height: '100%', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <h3>{appId}</h3>
      <p className="placeholder-hint">Application not yet implemented</p>
    </div>
  );
}