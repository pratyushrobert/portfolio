import { getAllCommands, formatError } from '../commands';
import type { Command } from '../commands';

export const helpCommand: Command = {
  name: 'help',
  description: 'Show available commands',
  usage: 'help [command]',
  handler: async (args) => {
    if (args[0]) {
      const cmd = getAllCommands().find(c => c.name === args[0]);
      if (!cmd) {
        return formatError('help', `no manual entry for ${args[0]}`);
      }
      return `${cmd.name} - ${cmd.description}\nUsage: ${cmd.usage || cmd.name}`;
    }

    const cmds = getAllCommands();
    const maxNameLen = Math.max(...cmds.map(c => c.name.length));
    const lines = ['Available commands:'];
    for (const cmd of cmds) {
      const padded = cmd.name.padEnd(maxNameLen + 2);
      lines.push(`  ${padded}${cmd.description}`);
    }
    lines.push('\nType "help <command>" for more information.');
    return lines.join('\n');
  },
};