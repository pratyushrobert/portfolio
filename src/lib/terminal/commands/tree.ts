import type { Command } from '../commands';
import { resolvePath, formatError } from '../commands';
import { vfs } from '../../../lib/vfs';

export const treeCommand: Command = {
  name: 'tree',
  description: 'Display directory tree',
  usage: 'tree [path]',
  handler: async (args) => {
    const path = args[0] ? resolvePath(args[0]) : vfs.getCwd();
    const result = vfs.tree(path);
    if (!result.success) {
      return formatError('tree', result.error || 'path not found');
    }
    return result.data!;
  },
};