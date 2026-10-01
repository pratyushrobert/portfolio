import type { Command } from '../commands';

export const mimiCommand: Command = {
  name: 'mimi',
  description: '🐈 MimiOS Security System',
  usage: 'mimi',
  handler: async () => {
    return `MimiOS Security System

Mimi has inspected your session. 🐈

Status: APPROVED

Please provide 1 treat.`;
  },
};