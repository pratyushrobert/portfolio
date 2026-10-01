import type { Command } from '../commands';
import { getCwd } from '../commands';

export const pwdCommand: Command = {
  name: 'pwd',
  description: 'Print working directory',
  usage: 'pwd',
  handler: async () => {
    return getCwd();
  },
};