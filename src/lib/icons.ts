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
  Search,
  FileImage,
  FileVideo,
  FileAudio,
  FileCode,
  FileJson,
  FileText as FileTextIcon,
  FolderGit2,
  Cpu,
  Briefcase,
  Award,
  User,
  Mail,
  Gamepad2,
} from 'lucide-react';
import { MimiMascotIcon } from '../components/ai/MimiMascot';

export type AppIconName =
  | 'terminal'
  | 'files'
  | 'file-manager'
  | 'text-viewer'
  | 'editor'
  | 'image-viewer'
  | 'video-player'
  | 'pdf-viewer'
  | 'resume-viewer'
  | 'admin-login'
  | 'admin-portal'
  | 'settings'
  | 'search'
  | 'projects'
  | 'project-viewer'
  | 'skills'
  | 'experience'
  | 'certificates'
  | 'about'
  | 'contact'
  | 'resume'
  | 'snake'
  | 'mimi-ai'
  | 'ai';

export const APP_ICONS: Record<AppIconName, React.ComponentType<{ size?: number; className?: string }>> = {
  terminal: Terminal,
  files: FolderOpen,
  'file-manager': FolderOpen,
  'text-viewer': FileTextIcon,
  editor: Code,
  'image-viewer': Image,
  'video-player': Video,
  'pdf-viewer': FileText,
  'resume-viewer': FileText,
  'admin-login': Lock,
  'admin-portal': Settings,
  settings: Settings,
  search: Search,
  projects: FolderGit2,
  'project-viewer': Code,
  skills: Cpu,
  experience: Briefcase,
  certificates: Award,
  about: User,
  contact: Mail,
  resume: FileText,
  snake: Gamepad2,
  'mimi-ai': MimiMascotIcon,
  ai: MimiMascotIcon,
};

// Common aliases and legacy identifier lookups
const ALIASES: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  filemanager: FolderOpen,
  folderopen: FolderOpen,
  folder: FolderOpen,
  files: FolderOpen,
  terminal: Terminal,
  settings: Settings,
  editor: Code,
  code: Code,
  edit: Code,
  search: Search,
  textviewer: FileTextIcon,
  imageviewer: Image,
  videoplayer: Video,
  pdfviewer: FileText,
  resumeviewer: FileText,
  filetext: FileTextIcon,
  adminlogin: Lock,
  adminportal: Settings,
  lock: Lock,
  projects: FolderGit2,
  projectviewer: Code,
  skills: Cpu,
  experience: Briefcase,
  certificates: Award,
  about: User,
  profile: User,
  contact: Mail,
  resume: FileText,
};

export const MIME_TYPE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
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

export function getAppIcon(
  appId: string | React.ComponentType<{ size?: number; className?: string }>,
  mimeType?: string
): React.ComponentType<{ size?: number; className?: string }> {
  // If already a component (function or forwardRef object)
  if (appId && (typeof appId === 'function' || (typeof appId === 'object' && appId !== null && '$$typeof' in appId))) {
    return appId as React.ComponentType<{ size?: number; className?: string }>;
  }

  if (typeof appId !== 'string') {
    return File;
  }

  // First try direct lookup by appId
  if (appId) {
    if (APP_ICONS[appId as AppIconName]) {
      return APP_ICONS[appId as AppIconName];
    }
    const clean = appId.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const [key, icon] of Object.entries(APP_ICONS)) {
      if (key.toLowerCase().replace(/[^a-z0-9]/g, '') === clean) {
        return icon;
      }
    }
    if (ALIASES[clean]) {
      return ALIASES[clean];
    }
  }

  // Fall back to mimeType
  if (mimeType && MIME_TYPE_ICONS[mimeType]) {
    return MIME_TYPE_ICONS[mimeType];
  }

  // Default fallback
  return File;
}

export function getFileIcon(mimeType: string, isDirectory: boolean): React.ComponentType<{ size?: number; className?: string }> {
  if (isDirectory) {
    return FolderOpen;
  }

  if (mimeType && MIME_TYPE_ICONS[mimeType]) {
    return MIME_TYPE_ICONS[mimeType];
  }

  return File;
}