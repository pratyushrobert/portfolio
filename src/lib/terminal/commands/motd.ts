import type { Command } from '../commands';
import { vfs } from '../../../lib/vfs';

export const motdCommand: Command = {
  name: 'motd',
  description: 'Display message of the day',
  usage: 'motd',
  handler: async () => {
    const file = vfs.readFile('/etc/motd');
    if (file.success && file.data) {
      return file.data;
    }
    return `Welcome to MimiOS (Web Desktop).
All systems operational.
Type 'help' to view available commands.`;
  },
};
