import {
  Terminal,
  FolderOpen,
  FileText,
  Settings,
  Image,
  Video,
  File,
  Lock,
  Code,
  FileImage,
  FileVideo,
  FileAudio,
  FileCode,
  FileJson,
  FileText as FileTextIcon,
} from 'lucide-react';

export type AppIconName =
  | 'terminal'
  | 'files'
  | 'text-viewer'
  | 'editor'
  | 'image-viewer'
  | 'video-player'
  | 'pdf-viewer'
  | 'resume-viewer'
  | 'admin-login'
  | 'admin-portal'
  | 'settings';

export const APP_ICONS: Record<AppIconName, React.ComponentType<{ size?: number }>> = {
  terminal: Terminal,
  files: FolderOpen,
  'text-viewer': FileTextIcon,
  editor: Code,
  'image-viewer': Image,
  'video-player': Video,
  'pdf-viewer': FileText,
  'resume-viewer': FileText,
  'admin-login': Lock,
  'admin-portal': Settings,
  settings: Settings,
};

export const MIME_TYPE_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  'image/png': FileImage,
  'image/jpeg': FileImage,
  'image/gif': FileImage,
  'image/webp': FileImage,
  'image/svg+xml': FileImage,
  'video/mp4': FileVideo,
  'video/webm': FileVideo,
  'video/quicktime': FileVideo,
  'application/pdf': FileText,
  'text/plain': FileTextIcon,
  'text/markdown': FileTextIcon,
  'text/html': FileCode,
  'text/css': FileCode,
  'application/javascript': FileCode,
  'application/typescript': FileCode,
  'application/json': FileJson,
  'application/x-javascript': FileCode,
  'application/x-typescript': FileCode,
  'application/zip': File,
  'application/x-zip-compressed': File,
  'application/x-rar-compressed': File,
  'application/x-7z-compressed': File,
  'audio/mpeg': FileAudio,
  'audio/wav': FileAudio,
  'audio/ogg': FileAudio,
};

export function getAppIcon(appId: string, mimeType?: string): React.ComponentType<{ size?: number }> {
  // First try to get icon by appId
  if (appId && APP_ICONS[appId as AppIconName]) {
    return APP_ICONS[appId as AppIconName];
  }

  // Fall back to mimeType
  if (mimeType && MIME_TYPE_ICONS[mimeType]) {
    return MIME_TYPE_ICONS[mimeType];
  }

  // Default fallback
  return File;
}

export function getFileIcon(mimeType: string, isDirectory: boolean): React.ComponentType<{ size?: number }> {
  if (isDirectory) {
    return FolderOpen;
  }

  if (mimeType && MIME_TYPE_ICONS[mimeType]) {
    return MIME_TYPE_ICONS[mimeType];
  }

  return File;
}