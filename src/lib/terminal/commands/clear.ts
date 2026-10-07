import type { Command } from '../commands';

export const clearCommand: Command = {
  name: 'clear',
  description: 'Clear terminal screen',
  usage: 'clear',
  handler: async (_args, ctx) => {
    if (ctx.clear) {
      ctx.clear();
    } else {
      ctx.write('\x1b[2J\x1b[3J\x1b[H');
    }
  },
};

export const clsCommand: Command = {
  name: 'cls',
  description: 'Clear terminal screen (alias for clear)',
  usage: 'cls',
  handler: clearCommand.handler,
};
