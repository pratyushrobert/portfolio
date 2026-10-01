import type { Command } from '../commands';

export const whoamiCommand: Command = {
  name: 'whoami',
  description: 'Print current user',
  usage: 'whoami',
  handler: async () => {
    return 'pratyush';
  },
};