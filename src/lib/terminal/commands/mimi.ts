import type { Command } from '../commands';
import { unlockDiscovery } from '../../../lib/discovery';
import { useWindowStore } from '../../../stores/useWindowStore';

export function launchMimiAI(initialPrompt?: string): string {
  unlockDiscovery('mimi_cat');
  const { windows, openWindowWithParams, restoreWindow, focusWindow, updateWindowState } = useWindowStore.getState();
  const existing = windows.find((w) => w.appId === 'mimi-ai' || w.appId === 'ai');

  const trimmed = initialPrompt?.trim();

  if (existing) {
    if (existing.isMinimized) {
      restoreWindow(existing.id);
    }
    focusWindow(existing.id);
    if (trimmed) {
      updateWindowState(existing.id, {
        appParams: {
          ...existing.appParams,
          initialPrompt: trimmed,
        },
      });
    }
    return trimmed
      ? `Focused MimiAI with prompt: "${trimmed}"`
      : 'Focused existing MimiAI companion window. 🐾';
  }

  const windowId = `mimi-ai-${Date.now()}`;
  openWindowWithParams(
    {
      id: windowId,
      appId: 'mimi-ai',
      title: 'MimiAI',
      icon: 'mimi-ai',
      x: 120 + Math.random() * 80,
      y: 70 + Math.random() * 50,
      width: 840,
      height: 620,
      isMinimized: false,
      isMaximized: false,
    },
    trimmed ? { initialPrompt: trimmed } : undefined
  );

  return trimmed
    ? `Launching MimiAI with prompt: "${trimmed}"... 🐱⚔️`
    : 'Launching MimiAI — Cyber Ninja Cat companion... 🐱⚔️';
}

export const mimiCommand: Command = {
  name: 'mimi',
  description: '🐱 MimiOS Security Mascot Daemon & MimiAI Companion',
  usage: 'mimi [ai [prompt] | treat | pet | status]',
  handler: async (args) => {
    unlockDiscovery('mimi_cat');

    const sub = args[0]?.toLowerCase();

    if (sub === 'ai') {
      const prompt = args.slice(1).join(' ').trim();
      return launchMimiAI(prompt);
    }

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

    if (sub === 'status' || sub === '--status') {
      return `
  /\\_/\\  
 ( o.o )  MimiOS Cyber Ninja Security Mascot
  > ^ <   Status: Vigilant & Purring smoothly 🐾
Defense Shield: Active
Companion Mode: Ready ('mimi ai [prompt]' or 'ai')
`;
    }

    return `
  /\\_/\\  
 ( o.o )  MimiOS Security & Mascot Daemon
  > ^ <   Status: JUDGING YOUR TERMINAL COMMANDS 🐾

Mimi is supervising this session with strict scrutiny.
Commands:
  mimi ai [prompt]  - Launch or prompt the MimiAI Cyber Ninja Cat companion
  ai [prompt]        - Quick shortcut to MimiAI
  mimi treat         - Offer a fish treat
  mimi pet           - Pet the cat for compilation luck
`;
  },
};