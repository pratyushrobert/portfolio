import type { Command } from '../commands';
import { formatError } from '../commands';
import { useWindowStore } from '../../../stores/useWindowStore';
import { useMascotStore } from '../../../stores/useMascotStore';

export const closeCommand: Command = {
  name: 'close',
  description: 'Close an application window or desktop companion',
  usage: 'close <appId | windowId | mascot>',
  handler: async (args) => {
    if (args.length === 0) {
      return formatError('close', 'missing target to close (e.g., close mascot, close terminal)');
    }

    const target = args[0].toLowerCase().trim();

    if (target === 'mascot' || target === 'mimi') {
      useMascotStore.getState().dismissMascot();
      return 'Mimi mascot dismissed. You can reopen anytime with "mimi show" or from the desktop context menu.';
    }

    // Try closing window by windowId or appId
    const { windows, closeWindow } = useWindowStore.getState();
    const win = windows.find((w) => w.id === target || w.appId === target);
    if (win) {
      closeWindow(win.id);
      return `Closed window: ${win.title}`;
    }

    return formatError('close', `no running window found for "${target}"`);
  },
};
