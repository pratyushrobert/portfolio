import type { Command } from '../commands';
import { formatError, formatNotFound } from '../commands';
import { useWindowStore } from '../../../stores/useWindowStore';

/**
 * Hidden admin access command.
 * Not listed in help output.
 * Usage: access mimi-servant
 */
export const accessCommand: Command = {
  name: 'access',
  description: '',
  usage: 'access <service>',
  hidden: true,
  handler: async (args, _ctx) => {
    if (args.length === 0) {
      return formatError('access', 'missing service operand');
    }

    const service = args[0];

    if (service !== 'mimi-servant') {
      return formatNotFound(`access: ${service}`);
    }

    // Open admin login window
    const { openWindowWithParams } = useWindowStore.getState();

    const windowId = `admin-login-${Date.now()}`;

    openWindowWithParams(
      {
        id: windowId,
        appId: 'admin-login',
        title: 'MIMI-SERVANT',
        icon: 'Lock',
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 150,
        width: 420,
        height: 320,
        isMinimized: false,
        isMaximized: false,
      },
      undefined
    );

    return `Accessing MIMI-SERVANT...`;
  },
};