import type { Command } from '../commands';
import { resolvePath, formatError } from '../commands';
import { vfs } from '../../../lib/vfs';

export const statCommand: Command = {
  name: 'stat',
  description: 'Display file metadata',
  usage: 'stat <file>',
  handler: async (args) => {
    if (args.length === 0) {
      return formatError('stat', 'missing operand');
    }

    const path = resolvePath(args[0]);
    const result = vfs.stat(path);
    if (!result.success) {
      return formatError('stat', result.error || 'cannot stat file');
    }

    const s = result.data!;
    const typeStr = s.type.charAt(0).toUpperCase() + s.type.slice(1);
    const created = new Date(s.createdAt).toISOString().replace('T', ' ').substring(0, 19);
    const modified = new Date(s.modifiedAt).toISOString().replace('T', ' ').substring(0, 19);

    const lines = [
      `  File: ${s.path}`,
      `  Type: ${typeStr}`,
      `  Size: ${s.size} bytes`,
      `  Permissions: ${s.permissions}`,
      `  Owner: ${s.owner}`,
      `  Created: ${created}`,
      `  Modified: ${modified}`,
    ];

    if (s.mimeType) lines.push(`  MimeType: ${s.mimeType}`);
    if (s.isBinary !== undefined) lines.push(`  Binary: ${s.isBinary ? 'yes' : 'no'}`);
    if (s.target) lines.push(`  Target: ${s.target}`);

    return lines.join('\n');
  },
};