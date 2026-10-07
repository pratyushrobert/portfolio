import type { Command } from '../commands';
import { unlockDiscovery } from '../../../lib/discovery';

const FLAG = 'MimiOS{c4t_p0w3rf1l_g4t3way}';

export const challengeCommand: Command = {
  name: 'challenge',
  description: 'Interactive mini-CTF cybersecurity puzzle',
  usage: 'challenge [submit <flag>]',
  handler: async (args) => {
    if (args[0]?.toLowerCase() === 'submit') {
      const submitted = args.slice(1).join(' ').trim();
      if (submitted === FLAG) {
        unlockDiscovery('solved_ctf');
        return `
=====================================================
🚩 [CHALLENGE SOLVED!] 🚩
=====================================================
Brilliant work, Security Researcher!
You extracted and decoded the hidden flag.

Achievement Unlocked: [Cyber Researcher] 🏆

       ___________
      '._==_==_=_.'
      .-\\:      /-.
     | (|:.     |) |
      '-|:.     |-'
        \\::.    /
         '::. .'
           ) (
         _.' '._
        \`"""""""\`
"Mimi is thoroughly impressed by your investigative skills." 🐾
`;
      }
      return `[x] Incorrect flag submitted: "${submitted}".
Hint: Inspect ~/.secret or decode the cipher with the 'base64' command.`;
    }

    return `
=====================================================
🔒 [MimiOS Mini Cyber Challenge: Mission 01]
=====================================================
Target Objective:
A top-secret passphrase has been encoded and hidden by Mimi.
Can you uncover and decode the secret flag?

Clues:
1. Explore the VirtualFS filesystem: check ~/.secret/
2. Or decode this intercepted Base64 telemetry:
   TWltaU9TcntjNHRfcDB3M3JmMWxfZzR0M3dheX0=

Submission:
When found, submit your answer using:
  challenge submit <flag>

Good luck, Agent! 🕵️
`;
  },
};
