import { useWindowStore } from '../../stores/useWindowStore';
import { vfs } from '../vfs';
import { getAppIcon } from '../icons';

export type MimiActionName = 'open_app' | 'close_app' | 'focus_app' | 'navigate_filesystem';

export interface ApprovedAppMeta {
  id: string;
  name: string;
  description: string;
  defaultWidth: number;
  defaultHeight: number;
  iconName: string;
}

export const APPROVED_APPS: Record<string, ApprovedAppMeta> = {
  'mimi-ai': { id: 'mimi-ai', name: 'MimiAI', description: 'Cyber Ninja Cat AI companion', defaultWidth: 840, defaultHeight: 620, iconName: 'mimi-ai' },
  'terminal': { id: 'terminal', name: 'Terminal', description: 'System command shell', defaultWidth: 800, defaultHeight: 600, iconName: 'terminal' },
  'files': { id: 'files', name: 'File Manager', description: 'Browse virtual filesystem', defaultWidth: 800, defaultHeight: 600, iconName: 'files' },
  'about': { id: 'about', name: 'About Me', description: 'Developer biography & profile', defaultWidth: 800, defaultHeight: 600, iconName: 'about' },
  'projects': { id: 'projects', name: 'Projects', description: 'Featured software portfolio', defaultWidth: 800, defaultHeight: 600, iconName: 'projects' },
  'skills': { id: 'skills', name: 'Skills', description: 'Technical stack & proficiencies', defaultWidth: 800, defaultHeight: 600, iconName: 'skills' },
  'experience': { id: 'experience', name: 'Experience', description: 'Career timeline & achievements', defaultWidth: 800, defaultHeight: 600, iconName: 'experience' },
  'certificates': { id: 'certificates', name: 'Certificates', description: 'Verified credentials & awards', defaultWidth: 800, defaultHeight: 600, iconName: 'certificates' },
  'resume': { id: 'resume', name: 'Resume', description: 'Interactive PDF resume viewer', defaultWidth: 800, defaultHeight: 600, iconName: 'resume' },
  'editor': { id: 'editor', name: 'Code Editor', description: 'Lightweight syntax editor', defaultWidth: 800, defaultHeight: 600, iconName: 'editor' },
  'settings': { id: 'settings', name: 'Settings', description: 'System preferences & themes', defaultWidth: 760, defaultHeight: 520, iconName: 'settings' },
  'contact': { id: 'contact', name: 'Contact', description: 'Direct contact channels', defaultWidth: 800, defaultHeight: 600, iconName: 'contact' },
  'snake': { id: 'snake', name: 'Cyber Snake', description: 'Arcade mini-game', defaultWidth: 440, defaultHeight: 520, iconName: 'snake' },
};

export const RESTRICTED_APP_IDS = ['admin-portal', 'admin-login', 'admin'] as const;

export const CONFIRMATION_REQUIRED_APPS = ['editor', 'terminal'] as const;

export const APP_ALIASES: Record<string, string> = {
  'ai': 'mimi-ai',
  'mimiai': 'mimi-ai',
  'mimi_ai': 'mimi-ai',
  'mimi': 'mimi-ai',
  'file-manager': 'files',
  'filemanager': 'files',
  'file_manager': 'files',
  'file': 'files',
  'code-editor': 'editor',
  'code_editor': 'editor',
  'snake-game': 'snake',
  'snake_game': 'snake',
  'game': 'snake',
  'resume-viewer': 'resume',
  'pdf-viewer': 'resume',
};

export interface ActionResult {
  success: boolean;
  action: MimiActionName;
  appId?: string;
  path?: string;
  windowId?: string;
  message?: string;
  error?: string;
  requiresConfirmation?: boolean;
}

export function normalizeAppId(rawId: string): string {
  if (typeof rawId !== 'string') return '';
  const trimmed = rawId.trim().toLowerCase();
  if (APP_ALIASES[trimmed]) {
    return APP_ALIASES[trimmed];
  }
  return trimmed;
}

export function isAppApproved(appId: string): boolean {
  const normalized = normalizeAppId(appId);
  return Boolean(APPROVED_APPS[normalized]);
}

export function isAppRestricted(appId: string): boolean {
  const normalized = normalizeAppId(appId);
  return RESTRICTED_APP_IDS.includes(normalized as typeof RESTRICTED_APP_IDS[number]) ||
    normalized.startsWith('admin') ||
    normalized.includes('portal') ||
    normalized.includes('auth');
}

export function validateFilesystemPath(rawPath: string): { valid: boolean; normalizedPath?: string; error?: string } {
  if (typeof rawPath !== 'string' || !rawPath.trim()) {
    return { valid: false, error: 'Filesystem path must be a non-empty string.' };
  }

  const trimmed = rawPath.trim();

  // Reject paths with control characters, linebreaks or script payloads
  if (/[\x00-\x1F<>:"|?*]/.test(trimmed)) {
    return { valid: false, error: 'Path contains invalid characters.' };
  }

  // Normalize path using VFS resolver
  const resolved = vfs.resolvePath(trimmed);

  // Check against root escape
  if (!resolved.startsWith('/')) {
    return { valid: false, error: 'Path must resolve within the root filesystem.' };
  }

  // Deny private or secret directories
  const segments = resolved.toLowerCase().split('/').filter(Boolean);
  for (const seg of segments) {
    if (seg === '.secret' || seg === 'secret' || seg.includes('secret')) {
      return {
        valid: false,
        error: `Access Denied: Path "${resolved}" contains restricted or private directory contents.`,
      };
    }
    if (seg === 'admin' || seg === '.admin') {
      return {
        valid: false,
        error: `Access Denied: Administrative path "${resolved}" is restricted.`,
      };
    }
  }

  return { valid: true, normalizedPath: resolved };
}

export function validateFrontendAction(
  name: string,
  args: Record<string, unknown>
): {
  valid: boolean;
  name: MimiActionName;
  sanitizedArgs: Record<string, unknown>;
  requiresConfirmation: boolean;
  error?: string;
} {
  const validActions: MimiActionName[] = ['open_app', 'close_app', 'focus_app', 'navigate_filesystem'];

  if (!validActions.includes(name as MimiActionName)) {
    return {
      valid: false,
      name: 'open_app',
      sanitizedArgs: {},
      requiresConfirmation: false,
      error: `Action "${name}" is not a recognized MimiOS action. Permitted actions: ${validActions.join(', ')}`,
    };
  }

  const actionName = name as MimiActionName;

  if (actionName === 'open_app' || actionName === 'focus_app') {
    const rawAppId = typeof args.appId === 'string' ? args.appId : '';
    if (!rawAppId.trim()) {
      return {
        valid: false,
        name: actionName,
        sanitizedArgs: {},
        requiresConfirmation: false,
        error: `Missing required "appId" parameter for action ${actionName}.`,
      };
    }

    if (isAppRestricted(rawAppId)) {
      return {
        valid: false,
        name: actionName,
        sanitizedArgs: {},
        requiresConfirmation: false,
        error: `Access Denied: Application "${rawAppId}" is an administrative or restricted portal. MimiAI cannot access it.`,
      };
    }

    const normalized = normalizeAppId(rawAppId);
    if (!isAppApproved(normalized)) {
      return {
        valid: false,
        name: actionName,
        sanitizedArgs: {},
        requiresConfirmation: false,
        error: `Unknown application ID "${rawAppId}". Approved applications: ${Object.keys(APPROVED_APPS).join(', ')}`,
      };
    }

    return {
      valid: true,
      name: actionName,
      sanitizedArgs: { appId: normalized },
      requiresConfirmation: false,
    };
  }

  if (actionName === 'close_app') {
    const rawAppId = typeof args.appId === 'string' ? args.appId : '';
    if (!rawAppId.trim()) {
      return {
        valid: false,
        name: actionName,
        sanitizedArgs: {},
        requiresConfirmation: false,
        error: 'Missing required "appId" parameter for action close_app.',
      };
    }

    const normalized = normalizeAppId(rawAppId);
    const isContextual = normalized === 'current' || normalized === 'this' || normalized === 'active';
    const isApproved = isContextual || isAppApproved(normalized);

    if (!isApproved) {
      return {
        valid: false,
        name: actionName,
        sanitizedArgs: {},
        requiresConfirmation: false,
        error: `Cannot close unknown application ID "${rawAppId}".`,
      };
    }

    // Require confirmation if closing editor or terminal to prevent data loss
    const requiresConfirmation = CONFIRMATION_REQUIRED_APPS.includes(normalized as typeof CONFIRMATION_REQUIRED_APPS[number]);

    return {
      valid: true,
      name: actionName,
      sanitizedArgs: { appId: normalized },
      requiresConfirmation,
    };
  }

  if (actionName === 'navigate_filesystem') {
    const rawPath = typeof args.path === 'string' ? args.path : '';
    const pathCheck = validateFilesystemPath(rawPath);

    if (!pathCheck.valid || !pathCheck.normalizedPath) {
      return {
        valid: false,
        name: actionName,
        sanitizedArgs: {},
        requiresConfirmation: false,
        error: pathCheck.error || 'Invalid filesystem path provided.',
      };
    }

    return {
      valid: true,
      name: actionName,
      sanitizedArgs: { path: pathCheck.normalizedPath },
      requiresConfirmation: false,
    };
  }

  return {
    valid: false,
    name: actionName,
    sanitizedArgs: {},
    requiresConfirmation: false,
    error: `Unhandled action ${actionName}`,
  };
}

export async function executeMimiOsAction(
  name: string,
  args: Record<string, unknown>,
  currentWindowId?: string
): Promise<ActionResult> {
  const validation = validateFrontendAction(name, args);

  if (!validation.valid) {
    return {
      success: false,
      action: validation.name,
      error: validation.error || 'Action validation failed',
    };
  }

  const { sanitizedArgs } = validation;
  const store = useWindowStore.getState();

  // 1. OPEN APPLICATION
  if (validation.name === 'open_app') {
    const appId = sanitizedArgs.appId as string;
    const appMeta = APPROVED_APPS[appId];

    // Check if app is already open
    const existing = store.windows.find((w) => w.appId === appId);
    if (existing) {
      if (existing.isMinimized) {
        store.restoreWindow(existing.id);
      }
      store.focusWindow(existing.id);
      return {
        success: true,
        action: 'open_app',
        appId,
        windowId: existing.id,
        message: `${appMeta.name} is already open and has been brought to the foreground.`,
      };
    }

    // Open new window with approved defaults
    const windowId = `${appId}-${Date.now()}`;
    const icon = getAppIcon(appMeta.iconName || appId);
    const params = appId === 'resume' ? { path: '/home/pratyush/resume.pdf' } : undefined;

    store.openWindowWithParams(
      {
        id: windowId,
        appId,
        title: appMeta.name,
        icon,
        x: 100 + Math.random() * 100,
        y: 80 + Math.random() * 70,
        width: appMeta.defaultWidth,
        height: appMeta.defaultHeight,
        isMinimized: false,
        isMaximized: false,
      },
      params
    );

    return {
      success: true,
      action: 'open_app',
      appId,
      windowId,
      message: `${appMeta.name} opened successfully.`,
    };
  }

  // 2. FOCUS APPLICATION
  if (validation.name === 'focus_app') {
    const appId = sanitizedArgs.appId as string;
    const existing = store.windows.find((w) => w.appId === appId);

    if (!existing) {
      return {
        success: false,
        action: 'focus_app',
        appId,
        error: `Application "${APPROVED_APPS[appId]?.name || appId}" is not currently running. Use open_app to launch it.`,
      };
    }

    if (existing.isMinimized) {
      store.restoreWindow(existing.id);
    }
    store.focusWindow(existing.id);

    return {
      success: true,
      action: 'focus_app',
      appId,
      windowId: existing.id,
      message: `Focused ${existing.title}.`,
    };
  }

  // 3. CLOSE APPLICATION
  if (validation.name === 'close_app') {
    const rawTarget = sanitizedArgs.appId as string;

    let targetWindow = null;
    if (rawTarget === 'current' || rawTarget === 'this' || rawTarget === 'active') {
      // If currentWindowId provided, close that; otherwise close focused window
      targetWindow = currentWindowId
        ? store.windows.find((w) => w.id === currentWindowId)
        : store.windows.find((w) => w.id === store.focusedId);
    } else {
      targetWindow = store.windows.find((w) => w.appId === rawTarget);
    }

    if (!targetWindow) {
      return {
        success: false,
        action: 'close_app',
        appId: rawTarget,
        error: `Could not find an open window matching "${rawTarget}".`,
      };
    }

    store.closeWindow(targetWindow.id);

    return {
      success: true,
      action: 'close_app',
      appId: targetWindow.appId,
      windowId: targetWindow.id,
      message: `Closed "${targetWindow.title}".`,
    };
  }

  // 4. NAVIGATE FILESYSTEM
  if (validation.name === 'navigate_filesystem') {
    const targetPath = sanitizedArgs.path as string;

    // Verify directory exists in VirtualFS
    const listResult = vfs.list(targetPath);
    if (!listResult.success) {
      return {
        success: false,
        action: 'navigate_filesystem',
        path: targetPath,
        error: `Directory "${targetPath}" does not exist in VirtualFS (${listResult.error}).`,
      };
    }

    // Set CWD in VirtualFS
    vfs.setCwd(targetPath);

    // Synchronize File Manager window
    const existingFm = store.windows.find((w) => w.appId === 'files');
    if (existingFm) {
      if (existingFm.isMinimized) {
        store.restoreWindow(existingFm.id);
      }
      store.updateWindowState(existingFm.id, {
        appParams: {
          ...existingFm.appParams,
          path: targetPath,
        },
      });
      store.focusWindow(existingFm.id);
    } else {
      // Launch File Manager at that path
      const windowId = `files-${Date.now()}`;
      store.openWindowWithParams(
        {
          id: windowId,
          appId: 'files',
          title: 'File Manager',
          icon: getAppIcon('files'),
          x: 120,
          y: 90,
          width: 800,
          height: 600,
          isMinimized: false,
          isMaximized: false,
        },
        { path: targetPath }
      );
    }

    return {
      success: true,
      action: 'navigate_filesystem',
      path: targetPath,
      message: `Navigated File Manager to "${targetPath}".`,
    };
  }

  return {
    success: false,
    action: validation.name,
    error: 'Unhandled action execution.',
  };
}
