import type { Command } from '../commands';

export const matrixCommand: Command = {
  name: 'matrix',
  description: 'Enter the digital matrix (Easter egg)',
  usage: 'matrix',
  hidden: true,
  handler: async () => {
    return `\x1b[32m
01001101 01101001 01101101 01101001 01001111 01010011
=====================================================
Wake up, Neo...
The Matrix has you.
Follow the white cat... 🐈🐾
=====================================================
[SYSTEM BREACH AVERTED: Neural handshake established]
Type 'challenge' to test your cybersecurity skills.\x1b[0m`;
  },
};
