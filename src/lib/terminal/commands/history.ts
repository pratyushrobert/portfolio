import type { Command } from '../commands';

export const historyCommand: Command = {
  name: 'history',
  description: 'Show command history',
  usage: 'history',
  handler: async (_args, ctx) => {
    if (ctx.history.length === 0) {
      return '';
    }
    return ctx.history.map((cmd, i) => `  ${i + 1}  ${cmd}`).join('\n');
  },
};