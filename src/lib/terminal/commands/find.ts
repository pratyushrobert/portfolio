import type { Command } from '../commands';
import { resolvePath, formatError } from '../commands';
import { vfs } from '../../../lib/vfs';

export const findCommand: Command = {
  name: 'find',
  description: 'Find files by name',
  usage: 'find <name> [path]',
  handler: async (args) => {
    if (args.length === 0) {
      return formatError('find', 'missing operand');
    }

    const name = args[0];
    const startPath = args[1] ? resolvePath(args[1]) : vfs.getCwd();
    const result = vfs.find(name, startPath);
    if (!result.success) {
      return formatError('find', result.error || 'search failed');
    }

    if (result.data!.length === 0) {
      return '';
    }

    // Get full paths for results
    const paths = result.data!.map(node => {
      // Use the VFS's internal getNodePath if available, otherwise reconstruct
      return vfs.getNodePath ? vfs.getNodePath(node.id) : node.name;
    });
    return paths.join('\n');
  },
};