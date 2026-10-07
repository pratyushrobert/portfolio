import type { Command } from '../commands';
import { useWindowStore } from '../../../stores/useWindowStore';
import { unlockDiscovery } from '../../../lib/discovery';

export const snakeCommand: Command = {
  name: 'snake',
  description: 'Launch the retro Cyber Snake desktop game',
  usage: 'snake',
  handler: async () => {
    unlockDiscovery('retro_gamer');
    const { openWindowWithParams } = useWindowStore.getState();

    const windowId = `snake-${Date.now()}`;
    openWindowWithParams({
      id: windowId,
      appId: 'snake',
      title: 'Cyber Snake',
      icon: 'Gamepad2',
      x: 140 + Math.random() * 80,
      y: 90 + Math.random() * 60,
      width: 440,
      height: 520,
      isMinimized: false,
      isMaximized: false,
    });

    return 'Launching Cyber Snake... 🐍';
  },
};
