import type { Command } from '../commands';
import { resolvePath, formatError } from '../commands';
import { vfs } from '../../../lib/vfs';

export const touchCommand: Command = {
  name: 'touch',
  description: 'Create empty file',
  usage: 'touch <file> [file...]',
  handler: async (args) => {
    if (args.length === 0) {
      return formatError('touch', 'missing file operand');
    }

    for (const arg of args) {
      const path = resolvePath(arg);
      const result = vfs.writeFile(path, '');
      if (!result.success) {
        return formatError('touch', `${arg}: ${result.error}`);
      }
    }
    return '';
  },
};