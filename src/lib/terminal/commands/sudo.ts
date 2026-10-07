import type { Command } from '../commands';

export const sudoCommand: Command = {
  name: 'sudo',
  description: 'Execute a command with superuser privileges (Easter egg)',
  usage: 'sudo <command>',
  hidden: false,
  handler: async (args) => {
    const cmd = args.join(' ') || 'root';
    return `[sudo] password for pratyush: **********
user 'pratyush' is not in the sudoers file.
This incident ('${cmd}') has been logged and reported to Mimi (Chief Security Feline). 🐱🐾`;
  },
};
