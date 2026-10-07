import type { Command } from '../commands';
import { DISCOVERY_BADGES, getUnlockedDiscoveries } from '../../../lib/discovery';

export const achievementsCommand: Command = {
  name: 'achievements',
  description: 'View discovered MimiOS badges and secrets',
  usage: 'achievements',
  handler: async () => {
    const unlocked = getUnlockedDiscoveries();
    const lines = [
      `[ MimiOS Local Discovery Tracker ] (${unlocked.length}/${DISCOVERY_BADGES.length} Discovered)`,
      `Explore terminal commands, files, and mini-games to unlock more!`,
      ``,
    ];

    for (const badge of DISCOVERY_BADGES) {
      const isUnlocked = unlocked.includes(badge.id);
      const mark = isUnlocked ? `[✓]` : `[ ]`;
      const name = badge.name.padEnd(20);
      lines.push(`${mark} ${badge.icon} ${name} — ${badge.description}`);
    }

    return lines.join('\n');
  },
};

export const badgesCommand: Command = {
  ...achievementsCommand,
  name: 'badges',
  description: 'Alias for achievements',
  usage: 'badges',
};
