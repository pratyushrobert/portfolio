import type { Command } from '../commands';

export const hostnameCommand: Command = {
  name: 'hostname',
  description: 'Print system hostname',
  usage: 'hostname',
  handler: async () => {
    return 'mimi';
  },
};