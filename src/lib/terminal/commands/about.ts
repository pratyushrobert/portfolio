import type { Command } from '../commands';

export const aboutCommand: Command = {
  name: 'about',
  description: 'Display MimiOS project & developer overview',
  usage: 'about',
  handler: async () => {
    return `MimiOS — Interactive Developer & Cybersecurity Portfolio
Engineered by Pratyush Robert

Core Architecture:
- Frontend: React 19, TypeScript, Zustand, xterm.js
- Backend:  Fastify 5, PostgreSQL (Supabase), Bcrypt Auth
- Storage:  POSIX-compliant in-browser VirtualFS & Remote GitHub Browser

Features:
- Simulated terminal environment with interactive utilities
- Multi-window desktop manager with movable and resizable panels
- Live portfolio integration (Projects, Skills, Experience, Certs)
- Secure session administration portal

Tip: Use 'help' to discover commands or browse the desktop icons!`;
  },
};
