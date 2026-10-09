import type { Command } from '../commands';
import { launchMimiAI } from './mimi';

export const aiCommand: Command = {
  name: 'ai',
  description: '🐱 Shortcut to launch MimiAI Cyber Ninja Cat companion',
  usage: 'ai [prompt]',
  handler: async (args) => {
    const prompt = args.join(' ').trim();
    return launchMimiAI(prompt);
  },
};
