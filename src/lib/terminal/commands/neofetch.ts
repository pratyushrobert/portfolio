import type { Command } from '../commands';
import { getCwd } from '../commands';
import { vfs } from '../../../lib/vfs';

export const neofetchCommand: Command = {
  name: 'neofetch',
  description: 'Display MimiOS system information',
  usage: 'neofetch',
  handler: async () => {
    const cwd = getCwd();
    const state = vfs.getState();
    const nodeCount = Object.keys(state.nodes).length;

    const cat = `
       /\\_/\\\\
      ( o.o )
       > ^ <`;

    const info = [
      'OS: MimiOS',
      'Host: mimi',
      'User: pratyush',
      'Shell: mos-shell',
      `CWD: ${cwd}`,
      `Filesystem: VirtualFS (${nodeCount} nodes)`,
    ];

    // Combine cat art with info side by side
    const catLines = cat.trim().split('\n');
    const maxCatWidth = Math.max(...catLines.map(l => l.length));
    const combined = catLines.map((line, i) => {
      const padded = line.padEnd(maxCatWidth + 2);
      return padded + (info[i] || '');
    });

    return combined.join('\n');
  },
};