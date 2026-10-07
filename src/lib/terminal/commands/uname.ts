import type { Command } from '../commands';

export const unameCommand: Command = {
  name: 'uname',
  description: 'Print operating system name and architecture',
  usage: 'uname [-a]',
  handler: async (args) => {
    if (args.includes('-a') || args.includes('--all')) {
      const arch = typeof navigator !== 'undefined' && navigator.userAgent.includes('x86_64') ? 'x86_64' : 'wasm32';
      return `MimiOS 1.0.0-release mos-${arch} WebAssembly/React GNU/MimiOS`;
    }
    return 'MimiOS';
  },
};
