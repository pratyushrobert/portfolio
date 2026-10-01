import type { Command } from '../commands';

export const echoCommand: Command = {
  name: 'echo',
  description: 'Print text',
  usage: 'echo [text...]',
  handler: async (args) => {
    return args.join(' ');
  },
};