import type { Command } from '../commands';
import { resolvePath, formatError } from '../commands';
import { vfs } from '../../../lib/vfs';

export const catCommand: Command = {
  name: 'cat',
  description: 'Display file contents',
  usage: 'cat <file> [file...]',
  handler: async (args) => {
    if (args.length === 0) {
      return formatError('cat', 'missing file operand');
    }

    const results: string[] = [];
    for (const arg of args) {
      const path = resolvePath(arg);
      const result = vfs.readFile(path);
      if (!result.success) {
        return formatError('cat', `${arg}: ${result.error || 'No such file or directory'}`);
      }
      results.push(result.data!);
    }
    return results.join('\n');
  },
};