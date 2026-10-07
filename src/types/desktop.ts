export interface DesktopIcon {
  id: string;
  label: string;
  icon: string; // lucide icon name
  x: number;
  y: number;
  col?: number;
  row?: number;
  appId: string; // maps to window/app
}

export interface WindowState {
  id: string;
  appId: string;
  title: string;
  icon?: string | React.ComponentType<{ size?: number; className?: string }>;
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

export type PanelPosition = 'top' | 'bottom' | 'left' | 'right';
export type PanelStyle = 'floating' | 'connected';

export interface DesktopState {
  wallpaper: string;
  wallpaperPosition?: string;
  wallpaperSize?: string;
  wallpaperOverlay?: string;
  wallpaperColor?: string;
  wallpaperBrightness?: number;
  wallpaperOverlayOpacity?: number;
  icons: DesktopIcon[];
  panelPosition: PanelPosition;
  panelStyle?: PanelStyle;
  showPanel: boolean;
  systemVolume?: number;
  systemMuted?: boolean;
  wifiEnabled?: boolean;
  bluetoothEnabled?: boolean;
  airplaneMode?: boolean;
}

export interface AppDefinition {
  id: string;
  name: string;
  icon: React.ComponentType<{ size?: number; className?: string }> | string;
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

export interface DesktopOpenRequest {
  type: string;
  appId?: string;
  path?: string;
  mimeType?: string;
  title?: string;
  icon?: string;
  params?: Record<string, unknown>;
}