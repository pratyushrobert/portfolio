export type WindowState = 'normal' | 'minimized' | 'maximized';

export interface WindowConfig {
  id: string;
  title: string;
  component: string; // Component name to render
  props?: Record<string, unknown>;
  defaultWidth?: number;
  defaultHeight?: number;
  defaultX?: number;
  defaultY?: number;
  minWidth?: number;
  minHeight?: number;
  resizable?: boolean;
  maximizable?: boolean;
  minimizable?: boolean;
  closable?: boolean;
  icon?: string; // Lucide icon name
}

export interface WindowInstance extends WindowConfig {
  state: WindowState;
  zIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  previousX?: number;
  previousY?: number;
  previousWidth?: number;
  previousHeight?: number;
  isFocused: boolean;
}

export type AppId =
  | 'terminal'
  | 'file-manager'
  | 'about'
  | 'projects'
  | 'resume-viewer'
  | 'image-viewer'
  | 'video-player'
  | 'settings'
  | 'admin-panel';

export const APP_CONFIGS: Record<AppId, WindowConfig> = {
  terminal: {
    id: 'terminal',
    title: 'Terminal',
    component: 'Terminal',
    icon: 'terminal',
    defaultWidth: 800,
    defaultHeight: 500,
    minWidth: 400,
    minHeight: 300,
  },
  'file-manager': {
    id: 'file-manager',
    title: 'File Manager',
    component: 'FileManager',
    icon: 'folder-open',
    defaultWidth: 900,
    defaultHeight: 600,
    minWidth: 500,
    minHeight: 400,
  },
  about: {
    id: 'about',
    title: 'About Me',
    component: 'About',
    icon: 'user',
    defaultWidth: 600,
    defaultHeight: 500,
    minWidth: 400,
    minHeight: 350,
  },
  projects: {
    id: 'projects',
    title: 'Projects',
    component: 'Projects',
    icon: 'briefcase',
    defaultWidth: 900,
    defaultHeight: 600,
    minWidth: 500,
    minHeight: 400,
  },
  'resume-viewer': {
    id: 'resume-viewer',
    title: 'Resume',
    component: 'ResumeViewer',
    icon: 'file-text',
    defaultWidth: 800,
    defaultHeight: 600,
    minWidth: 500,
    minHeight: 400,
  },
  'image-viewer': {
    id: 'image-viewer',
    title: 'Image Viewer',
    component: 'ImageViewer',
    icon: 'image',
    defaultWidth: 800,
    defaultHeight: 600,
    minWidth: 400,
    minHeight: 300,
  },
  'video-player': {
    id: 'video-player',
    title: 'Video Player',
    component: 'VideoPlayer',
    icon: 'video',
    defaultWidth: 900,
    defaultHeight: 600,
    minWidth: 500,
    minHeight: 350,
  },
  settings: {
    id: 'settings',
    title: 'Settings',
    component: 'Settings',
    icon: 'settings',
    defaultWidth: 600,
    defaultHeight: 500,
    minWidth: 400,
    minHeight: 350,
  },
  'admin-panel': {
    id: 'admin-panel',
    title: 'Admin Panel',
    component: 'AdminPanel',
    icon: 'shield',
    defaultWidth: 1000,
    defaultHeight: 700,
    minWidth: 600,
    minHeight: 500,
  },
};