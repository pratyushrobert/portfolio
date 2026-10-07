import type { Command } from '../commands';
import { getCwd } from '../commands';
import { vfs } from '../../../lib/vfs';
import { unlockDiscovery } from '../../../lib/discovery';

function getBrowserName(): string {
  if (typeof navigator === 'undefined') return 'Unknown Browser';
  const ua = navigator.userAgent;
  if (ua.includes('Firefox/')) return 'Mozilla Firefox';
  if (ua.includes('Edg/')) return 'Microsoft Edge';
  if (ua.includes('Chrome/')) return 'Google Chrome';
  if (ua.includes('Safari/')) return 'Apple Safari';
  return 'WebBrowser';
}

function getPlatformName(): string {
  if (typeof navigator === 'undefined') return 'Web';
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return nav.userAgentData?.platform || navigator.platform || 'POSIX (Web)';
}

export const neofetchCommand: Command = {
  name: 'neofetch',
  description: 'Display MimiOS system diagnostic summary',
  usage: 'neofetch',
  handler: async () => {
    unlockDiscovery('neofetch');

    const cwd = getCwd();
    const state = vfs.getState();
    const nodeCount = Object.keys(state.nodes).length;

    const resolution = typeof window !== 'undefined'
      ? `${window.innerWidth}x${window.innerHeight}`
      : '1920x1080';

    const cat = `
       /\\_/\\
      ( o.o )
       > ^ <
     /       \\
    (_/       \\_)`;

    const info = [
      'OS: MimiOS v1.0.0 (Web Desktop)',
      'Host: mimi-desktop',
      'Kernel: 1.0.0-wasm32-mos',
      `Browser: ${getBrowserName()}`,
      `Platform: ${getPlatformName()}`,
      `Resolution: ${resolution}`,
      'Shell: mos-sh (xterm.js 5.3)',
      `VFS Storage: ${nodeCount} nodes indexed`,
      `CWD: ${cwd}`,
      'Security: Active (Signed Session)',
    ];

    const catLines = cat.trim().split('\n');
    const maxCatWidth = Math.max(...catLines.map(l => l.length));
    const combined = catLines.map((line, i) => {
      const padded = line.padEnd(maxCatWidth + 4);
      return padded + (info[i] || '');
    });

    // Append remaining info lines if any
    if (info.length > catLines.length) {
      for (let i = catLines.length; i < info.length; i++) {
        combined.push(' '.repeat(maxCatWidth + 4) + info[i]);
      }
    }

    return combined.join('\n');
  },
};

export const systeminfoCommand: Command = {
  ...neofetchCommand,
  name: 'systeminfo',
  description: 'Display MimiOS system information (alias for neofetch)',
  usage: 'systeminfo',
};