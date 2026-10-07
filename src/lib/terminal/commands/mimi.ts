import type { Command } from '../commands';
import { unlockDiscovery } from '../../../lib/discovery';

export const mimiCommand: Command = {
  name: 'mimi',
  description: '🐱 MimiOS Security & Mascot Daemon',
  usage: 'mimi [--status|treat|pet]',
  handler: async (args) => {
    unlockDiscovery('mimi_cat');

    const sub = args[0]?.toLowerCase();

    if (sub === 'treat') {
      return `
  /\\_/\\  
 ( ^.^ )  *purrrrr*
  > 🐟 <  Mimi graciously accepts the fish treat. Security clearance upgraded to VIP!
`;
    }

    if (sub === 'pet') {
      return `
  /\\_/\\  
 ( ='.'= ) *happy purr vibrations*
 (")_(")  Mimi grants you good luck on your code compilations today.
`;
    }

    return `
  /\\_/\\  
 ( o.o )  MimiOS Security & Mascot Daemon
  > ^ <   Status: JUDGING YOUR TERMINAL COMMANDS 🐾

Mimi is supervising this session with strict scrutiny.
"All systems purring smoothly. Give treats using 'mimi treat' or 'mimi pet'."
`;
  },
};