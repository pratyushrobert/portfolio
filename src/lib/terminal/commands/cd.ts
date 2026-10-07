import type { Command } from '../commands';
import { resolvePath, setCwd, formatError } from '../commands';

export const cdCommand: Command = {
  name: 'cd',
  description: 'Change directory',
  usage: 'cd [path]',
  handler: async (args) => {
    const pathArg = args[0] || '~';
    let path = pathArg;

    // Handle ~ expansion
    if (path === '~' || path.startsWith('~/')) {
      path = path.replace('~', '/home/pratyush');
    }

    const resolved = resolvePath(path);
    const result = setCwd(resolved);
    if (!result.success) {
      return formatError('cd', result.error || `no such file or directory: ${pathArg}`);
    }
    return '';
  },
};