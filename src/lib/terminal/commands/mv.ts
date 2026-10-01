import type { Command } from '../commands';
import { resolvePath, formatError } from '../commands';
import { vfs } from '../../../lib/vfs';

export const mvCommand: Command = {
  name: 'mv',
  description: 'Move/rename files or directories',
  usage: 'mv <source> <dest>',
  handler: async (args) => {
    if (args.length < 2) {
      return formatError('mv', 'missing operand');
    }

    const src = resolvePath(args[0]);
    const dest = resolvePath(args[1]);
    const result = vfs.mv(src, dest);
    if (!result.success) {
      return formatError('mv', result.error || 'operation failed');
    }
    return '';
  },
};