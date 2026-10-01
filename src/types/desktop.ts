export interface DesktopIcon {
  id: string;
  label: string;
  icon: string; // lucide icon name
  x: number;
  y: number;
  appId: string; // maps to window/app
}

export interface WindowState {
  id: string;
  appId: string;
  title: string;
  icon: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isMinimized: boolean;
  isMaximized: boolean;
  isFocused: boolean;
  zIndex: number;
  appParams?: Record<string, unknown>; // App-specific parameters (e.g., file path for viewers)
}

export interface DesktopState {
  wallpaper: string;
  icons: DesktopIcon[];
  panelPosition: 'top' | 'bottom';
  showPanel: boolean;
}

export interface AppDefinition {
  id: string;
  name: string;
  icon: string;
  component: React.ComponentType<WindowProps>;
}

export interface WindowProps {
  windowId: string;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  isMaximized: boolean;
  appParams?: Record<string, unknown>; // App-specific parameters passed at launch
}