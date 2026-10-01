import type { Command } from '../commands';
import { resolvePath, formatError } from '../commands';
import { vfs } from '../../../lib/vfs';

export const mkdirCommand: Command = {
  name: 'mkdir',
  description: 'Create directory',
  usage: 'mkdir <path> [path...]',
  handler: async (args) => {
    if (args.length === 0) {
      return formatError('mkdir', 'missing operand');
    }

    for (const arg of args) {
      const path = resolvePath(arg);
      const result = vfs.mkdir(path);
      if (!result.success) {
        return formatError('mkdir', `${arg}: ${result.error}`);
      }
    }
    return '';
  },
};