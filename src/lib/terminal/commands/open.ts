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
  usage: 'open <file>',
  handler: async (args) => {
    if (args.length === 0) {
      return formatError('open', 'missing file operand');
    }

    const path = resolvePath(args[0]);
    const result = vfs.stat(path);
    if (!result.success) {
      return formatError('open', `${args[0]}: ${result.error}`);
    }

    const stat = result.data!;
    // Use stat to determine type, no need for private getNodeByPath
    // For files, we can infer mime type from extension or use default
    let appId = 'editor';
    let mimeType = 'text/plain';

    if (stat.type === 'file') {
      // Infer mime type from extension
      const ext = path.split('.').pop()?.toLowerCase() || '';
      if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
        appId = 'image-viewer';
        mimeType = 'image/' + (ext === 'svg' ? 'svg+xml' : ext === 'jpg' ? 'jpeg' : ext);
      } else if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) {
        appId = 'video-player';
        mimeType = 'video/' + ext;
      } else if (ext === 'pdf') {
        appId = 'resume-viewer';
        mimeType = 'application/pdf';
      } else if (['txt', 'md', 'js', 'ts', 'jsx', 'tsx', 'json', 'css', 'html'].includes(ext)) {
        appId = 'editor';
        mimeType = 'text/plain';
      }
    } else if (stat.type === 'directory') {
      appId = 'files';
    }

    // Return an open request that the desktop can handle
    const openRequest: OpenRequest = {
      type: 'open',
      path,
      appId,
      mimeType,
    };

    // Store in window for desktop to pick up
    (window as any).__MIMIOS_OPEN_REQUEST__ = openRequest;

    return `Opening ${path} with ${appId}...`;
  },
};