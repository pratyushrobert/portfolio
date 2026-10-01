import type { Command } from '../commands';
import { resolvePath, formatError } from '../commands';
import { vfs } from '../../../lib/vfs';

export const rmCommand: Command = {
  name: 'rm',
  description: 'Remove files or directories',
  usage: 'rm [-r] <path> [path...]',
  handler: async (args) => {
    const recursive = args.includes('-r') || args.includes('-rf') || args.includes('-fr');
    const paths = args.filter(a => !a.startsWith('-'));

    if (paths.length === 0) {
      return formatError('rm', 'missing operand');
    }

    for (const arg of paths) {
      const path = resolvePath(arg);
      const result = await vfs.rm(path, recursive);
      if (!result.success) {
        const error = result.error;
        if (error?.includes('not empty') || error?.includes('Directory not empty')) {
          return formatError('rm', `${arg}: Is a directory (use -r to remove)`);
        }
        return formatError('rm', `${arg}: ${error}`);
      }
    }
    return '';
  },
};