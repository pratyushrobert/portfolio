export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required: string[];
    };
  };
}

export const APPROVED_APP_IDS = [
  'files',
  'terminal',
  'about',
  'projects',
  'skills',
  'experience',
  'certificates',
  'resume',
  'editor',
  'settings',
  'contact',
  'snake',
  'mimi-ai',
] as const;

export const RESTRICTED_APP_IDS = ['admin-portal', 'admin-login', 'admin'] as const;

export const CONFIRMATION_REQUIRED_APPS = ['editor', 'terminal'] as const;

export const APP_ALIASES: Record<string, string> = {
  ai: 'mimi-ai',
  mimiai: 'mimi-ai',
  mimi_ai: 'mimi-ai',
  mimi: 'mimi-ai',
  'file-manager': 'files',
  filemanager: 'files',
  file_manager: 'files',
  file: 'files',
  'code-editor': 'editor',
  code_editor: 'editor',
  'snake-game': 'snake',
  snake_game: 'snake',
  game: 'snake',
  'resume-viewer': 'resume',
  'pdf-viewer': 'resume',
};

export const MIMIOS_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'open_app',
      description:
        'Launch or bring to foreground an approved MimiOS desktop application by its appId (e.g. "files", "projects", "settings", "terminal", "about", "snake", "editor"). Never call on admin applications.',
      parameters: {
        type: 'object',
        properties: {
          appId: {
            type: 'string',
            description:
              'The registered application ID to open. Must be one of the user-accessible MimiOS apps.',
            enum: [...APPROVED_APP_IDS],
          },
        },
        required: ['appId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'close_app',
      description:
        'Close an open window or application on the MimiOS desktop. Pass "current" to close the active or companion window.',
      parameters: {
        type: 'object',
        properties: {
          appId: {
            type: 'string',
            description:
              'The application ID to close (e.g. "files", "terminal", "settings", or "current").',
          },
        },
        required: ['appId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'focus_app',
      description:
        'Bring an existing open MimiOS application window to the foreground and focus it.',
      parameters: {
        type: 'object',
        properties: {
          appId: {
            type: 'string',
            description: 'The application ID of the running window to bring to the front.',
            enum: [...APPROVED_APP_IDS],
          },
        },
        required: ['appId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'navigate_filesystem',
      description:
        'Navigate the MimiOS virtual file manager to a specific directory path (e.g. "/home/pratyush/documents", "/home/pratyush/images", "/home/pratyush/skills"). Private, admin, or secret directories are strictly denied.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description:
              'The virtual filesystem directory path to navigate to (e.g., "/home/pratyush/documents").',
          },
        },
        required: ['path'],
      },
    },
  },
];

export interface ValidatedToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  requiresConfirmation: boolean;
  valid: boolean;
  error?: string;
}

export function normalizeAppId(rawId: string): string {
  if (typeof rawId !== 'string') return '';
  const trimmed = rawId.trim().toLowerCase();
  return APP_ALIASES[trimmed] || trimmed;
}

export function isAppRestricted(appId: string): boolean {
  const normalized = normalizeAppId(appId);
  return (
    RESTRICTED_APP_IDS.includes(normalized as typeof RESTRICTED_APP_IDS[number]) ||
    normalized.startsWith('admin') ||
    normalized.includes('portal') ||
    normalized.includes('auth')
  );
}

export function isAppApproved(appId: string): boolean {
  const normalized = normalizeAppId(appId);
  return APPROVED_APP_IDS.includes(normalized as typeof APPROVED_APP_IDS[number]);
}

export function normalizePath(path: string): string {
  const collapsed = path.replace(/\/+/g, '/');
  if (collapsed.startsWith('/')) {
    const parts = collapsed.split('/').filter(Boolean);
    const result: string[] = [];
    for (const part of parts) {
      if (part === '..') {
        if (result.length > 0) result.pop();
      } else if (part !== '.') {
        result.push(part);
      }
    }
    return '/' + result.join('/');
  }

  // Relative path - assume /home/pratyush
  const baseParts = ['home', 'pratyush'];
  const parts = collapsed.split('/').filter(Boolean);
  for (const part of parts) {
    if (part === '..') {
      if (baseParts.length > 0) baseParts.pop();
    } else if (part !== '.') {
      baseParts.push(part);
    }
  }
  return '/' + baseParts.join('/');
}

export function validateMimiOsToolCall(toolCall: {
  id: string;
  name: string;
  arguments: Record<string, unknown> | string;
}): ValidatedToolCall {
  const { id, name } = toolCall;

  // 1. Check tool name against allowed registry
  const allowedNames = ['open_app', 'close_app', 'focus_app', 'navigate_filesystem'];
  if (!allowedNames.includes(name)) {
    return {
      id,
      name,
      arguments: {},
      requiresConfirmation: false,
      valid: false,
      error: `Action "${name}" is not a recognized MimiOS action. Permitted actions: ${allowedNames.join(', ')}`,
    };
  }

  // 2. Parse arguments safely
  let args: Record<string, unknown> = {};
  if (typeof toolCall.arguments === 'string') {
    try {
      args = JSON.parse(toolCall.arguments);
    } catch {
      return {
        id,
        name,
        arguments: {},
        requiresConfirmation: false,
        valid: false,
        error: 'Malformed JSON arguments received in tool call.',
      };
    }
  } else if (typeof toolCall.arguments === 'object' && toolCall.arguments !== null) {
    args = toolCall.arguments;
  } else {
    return {
      id,
      name,
      arguments: {},
      requiresConfirmation: false,
      valid: false,
      error: 'Tool call arguments must be an object or JSON string.',
    };
  }

  // 3. Action-specific validation
  if (name === 'open_app' || name === 'focus_app') {
    const rawAppId = typeof args.appId === 'string' ? args.appId.trim() : '';
    if (!rawAppId) {
      return {
        id,
        name,
        arguments: args,
        requiresConfirmation: false,
        valid: false,
        error: `Missing required "appId" parameter for action ${name}.`,
      };
    }

    if (isAppRestricted(rawAppId)) {
      return {
        id,
        name,
        arguments: { appId: rawAppId },
        requiresConfirmation: false,
        valid: false,
        error: `Access Denied: Application "${rawAppId}" is an administrative or restricted portal. MimiAI cannot access it.`,
      };
    }

    const normalized = normalizeAppId(rawAppId);
    if (!isAppApproved(normalized)) {
      return {
        id,
        name,
        arguments: { appId: rawAppId },
        requiresConfirmation: false,
        valid: false,
        error: `Unknown application ID "${rawAppId}". Approved applications are: ${APPROVED_APP_IDS.join(', ')}.`,
      };
    }

    return {
      id,
      name,
      arguments: { appId: normalized },
      requiresConfirmation: false,
      valid: true,
    };
  }

  if (name === 'close_app') {
    const rawAppId = typeof args.appId === 'string' ? args.appId.trim() : '';
    if (!rawAppId) {
      return {
        id,
        name,
        arguments: args,
        requiresConfirmation: false,
        valid: false,
        error: 'Missing required "appId" parameter for action close_app.',
      };
    }

    const normalized = normalizeAppId(rawAppId);
    const isContextual = normalized === 'current' || normalized === 'this' || normalized === 'active';
    const isApproved = isContextual || isAppApproved(normalized);

    if (!isApproved) {
      return {
        id,
        name,
        arguments: { appId: rawAppId },
        requiresConfirmation: false,
        valid: false,
        error: `Cannot close unknown application ID "${rawAppId}".`,
      };
    }

    // Require confirmation for sensitive work apps like code editor or terminal
    const requiresConfirmation = CONFIRMATION_REQUIRED_APPS.includes(
      normalized as typeof CONFIRMATION_REQUIRED_APPS[number]
    );

    return {
      id,
      name,
      arguments: { appId: normalized },
      requiresConfirmation,
      valid: true,
    };
  }

  if (name === 'navigate_filesystem') {
    const rawPath = typeof args.path === 'string' ? args.path.trim() : '';
    if (!rawPath) {
      return {
        id,
        name,
        arguments: args,
        requiresConfirmation: false,
        valid: false,
        error: 'Missing required "path" parameter for action navigate_filesystem.',
      };
    }

    // Block injection payloads or control characters
    if (/[\x00-\x1F<>:"|?*]/.test(rawPath)) {
      return {
        id,
        name,
        arguments: { path: rawPath },
        requiresConfirmation: false,
        valid: false,
        error: 'Path contains illegal control characters.',
      };
    }

    const normalized = normalizePath(rawPath);

    // Block root escape
    if (!normalized.startsWith('/')) {
      return {
        id,
        name,
        arguments: { path: rawPath },
        requiresConfirmation: false,
        valid: false,
        error: 'Filesystem navigation must remain inside the root virtual directory.',
      };
    }

    // Block restricted paths (.secret, secret, admin)
    const segments = normalized.toLowerCase().split('/').filter(Boolean);
    for (const seg of segments) {
      if (seg === '.secret' || seg === 'secret' || seg.includes('secret')) {
        return {
          id,
          name,
          arguments: { path: normalized },
          requiresConfirmation: false,
          valid: false,
          error: `Access Denied: Path "${normalized}" contains restricted or private directory contents.`,
        };
      }
      if (seg === 'admin' || seg === '.admin') {
        return {
          id,
          name,
          arguments: { path: normalized },
          requiresConfirmation: false,
          valid: false,
          error: `Access Denied: Administrative path "${normalized}" is restricted.`,
        };
      }
    }

    return {
      id,
      name,
      arguments: { path: normalized },
      requiresConfirmation: false,
      valid: true,
    };
  }

  return {
    id,
    name,
    arguments: args,
    requiresConfirmation: false,
    valid: false,
    error: `Unhandled action ${name}.`,
  };
}
