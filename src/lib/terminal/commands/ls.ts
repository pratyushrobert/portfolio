import type { Command } from '../commands';
import { resolvePath, formatError } from '../commands';
import { vfs } from '../../../lib/vfs';
import type { AnyVFSNode } from '../../../types/vfs';

export const lsCommand: Command = {
  name: 'ls',
  description: 'List directory contents',
  usage: 'ls [-la] [path]',
  handler: async (args) => {
    const showAll = args.includes('-a') || args.includes('-la') || args.includes('-al');
    const showLong = args.includes('-l') || args.includes('-la') || args.includes('-al');

    // Filter out flags to get path
    const pathArg = args.find(a => !a.startsWith('-'));
    const path = pathArg ? resolvePath(pathArg) : getCwd();

    const result = vfs.list(path);
    if (!result.success) {
      return formatError('ls', result.error || 'cannot access directory');
    }

    let entries = result.data!;

    // Filter hidden files unless -a
    if (!showAll) {
      entries = entries.filter(n => !n.name.startsWith('.'));
    }

    if (entries.length === 0) {
      return '';
    }

    if (showLong) {
      const lines = entries.map(n => {
        const typeChar = n.type === 'directory' ? 'd' : n.type === 'symlink' ? 'l' : '-';
        const perms = typeChar + n.permissions;
        const size = n.type === 'file' ? (n as any).size : 4096;
        const date = new Date(n.modifiedAt).toLocaleDateString();
        const time = new Date(n.modifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const name = n.name;
        return `${perms} 1 user ${String(size).padStart(8)} ${date} ${time} ${name}`;
      });
      return lines.join('\n');
    }

    // Simple format - just names
    return entries.map(n => n.name).join('  ');
  },
};

function getCwd(): string {
  return vfs.getCwd();
}