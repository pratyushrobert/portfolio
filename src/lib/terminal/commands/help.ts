import { getAllCommands, formatError } from '../commands';
import type { Command } from '../commands';

const CATEGORIES: Record<string, string[]> = {
  'Filesystem': ['ls', 'cd', 'pwd', 'cat', 'mkdir', 'touch', 'rm', 'mv', 'cp', 'tree', 'find', 'stat'],
  'System & Info': ['help', 'clear', 'cls', 'neofetch', 'systeminfo', 'uname', 'whoami', 'hostname', 'history', 'motd', 'about'],
  'Applications': ['open', 'snake'],
  'Security & Tools': ['hash', 'base64', 'scan', 'nmap', 'challenge', 'achievements', 'badges'],
  'Personality': ['mimi', 'sudo'],
};

export const helpCommand: Command = {
  name: 'help',
  description: 'Show categorized list of available commands',
  usage: 'help [command]',
  handler: async (args) => {
    const all = getAllCommands();

    if (args[0]) {
      const targetName = args[0].toLowerCase();
      const cmd = all.find(c => c.name === targetName && !c.hidden);
      if (!cmd) {
        return formatError('help', `no manual entry for '${args[0]}'`);
      }
      return `${cmd.name} — ${cmd.description}\nUsage: ${cmd.usage || cmd.name}`;
    }

    const lines: string[] = [
      `MimiOS Shell — Available Commands`,
      `Type "help <command>" for specific parameter usage.`,
      ``,
    ];

    const commandMap = new Map(all.map(c => [c.name, c]));
    const displayed = new Set<string>();

    for (const [category, cmdNames] of Object.entries(CATEGORIES)) {
      const availableInCat: Command[] = [];
      for (const name of cmdNames) {
        const cmd = commandMap.get(name);
        if (cmd && !cmd.hidden && !displayed.has(cmd.name)) {
          availableInCat.push(cmd);
          displayed.add(cmd.name);
        }
      }

      if (availableInCat.length > 0) {
        lines.push(`[ ${category} ]`);
        const maxLen = Math.max(...availableInCat.map(c => c.name.length));
        for (const cmd of availableInCat) {
          const pad = cmd.name.padEnd(maxLen + 3);
          lines.push(`  ${pad}${cmd.description}`);
        }
        lines.push(``);
      }
    }

    // Uncategorized public commands if any
    const remaining = all.filter(c => !c.hidden && !displayed.has(c.name));
    if (remaining.length > 0) {
      lines.push(`[ Other Utilities ]`);
      const maxLen = Math.max(...remaining.map(c => c.name.length));
      for (const cmd of remaining) {
        const pad = cmd.name.padEnd(maxLen + 3);
        lines.push(`  ${pad}${cmd.description}`);
      }
      lines.push(``);
    }

    lines.push(`*Tip: Try exploring the filesystem or typing 'challenge' for a cyber puzzle.*`);
    return lines.join('\n');
  },
};