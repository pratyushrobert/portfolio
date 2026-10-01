import type { Command } from '../commands';
import { resolvePath, formatError } from '../commands';
import { vfs } from '../../../lib/vfs';

export const cpCommand: Command = {
  name: 'cp',
  description: 'Copy files or directories',
  usage: 'cp <source> <dest>',
  handler: async (args) => {
    if (args.length < 2) {
      return formatError('cp', 'missing operand');
    }

    const src = resolvePath(args[0]);
    const dest = resolvePath(args[1]);
    const result = vfs.cp(src, dest);
    if (!result.success) {
      return formatError('cp', result.error || 'operation failed');
    }
    return '';
  },
};