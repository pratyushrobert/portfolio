import type { Command } from '../commands';
import { resolvePath, formatError } from '../commands';
import { vfs } from '../../../lib/vfs';

export interface OpenRequest {
  type: 'open';
  path: string;
  appId?: string;
  mimeType?: string;
}

export const openCommand: Command = {
  name: 'open',
  description: 'Open file with associated application',
  usage: 'open <file> [-a|--app <appId>]',
  handler: async (args) => {
    if (args.length === 0) {
      return formatError('open', 'missing file operand');
    }

    let rawPath = '';
    let customAppId: string | undefined;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '-a' || arg === '--app') {
        if (i + 1 < args.length) {
          customAppId = args[i + 1];
          i++;
        }
      } else if (!rawPath) {
        rawPath = arg;
      }
    }

    if (!rawPath) {
      return formatError('open', 'missing file operand');
    }

    const path = resolvePath(rawPath);
    const result = vfs.stat(path);
    if (!result.success) {
      return formatError('open', `${rawPath}: ${result.error}`);
    }

    const stat = result.data!;
    let appId = customAppId || 'editor';
    let mimeType = 'text/plain';

    if (!customAppId) {
      if (stat.type === 'file') {
        // Infer mime type and application from extension
        const ext = path.split('.').pop()?.toLowerCase() || '';
        if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
          appId = 'image-viewer';
          mimeType = 'image/' + (ext === 'svg' ? 'svg+xml' : ext === 'jpg' ? 'jpeg' : ext);
        } else if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) {
          appId = 'video-player';
          mimeType = 'video/' + ext;
        } else if (ext === 'pdf') {
          appId = 'pdf-viewer';
          mimeType = 'application/pdf';
        } else if (['txt', 'md', 'markdown', 'js', 'ts', 'jsx', 'tsx', 'json', 'css', 'html', 'py', 'sh', 'sql', 'yaml', 'yml'].includes(ext)) {
          appId = 'editor';
          mimeType = 'text/plain';
        }
      } else if (stat.type === 'directory') {
        appId = 'files';
      }
    }

    // Return an open request that the desktop can handle
    const openRequest: OpenRequest = {
      type: 'open',
      path,
      appId,
      mimeType,
    };

    // Store in window for desktop to pick up and dispatch custom event
    (window as unknown as { __MIMIOS_OPEN_REQUEST__?: OpenRequest }).__MIMIOS_OPEN_REQUEST__ = openRequest;
    try {
      window.dispatchEvent(new CustomEvent('mimios-open-request', { detail: openRequest }));
    } catch {
      // fallback to window property
    }

    return `Opening ${path} with ${appId}...`;
  },
};