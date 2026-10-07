import { vfs } from '../../lib/vfs';

export interface CommandContext {
  vfs: typeof vfs;
  cwd: string;
  history: string[];
  write: (text: string) => void;
  writeln: (text: string) => void;
  clear?: () => void;
}

export type CommandHandler = (args: string[], ctx: CommandContext) => Promise<string | void> | string | void;

export interface Command {
  name: string;
  description: string;
  usage?: string;
  hidden?: boolean;
  handler: CommandHandler;
}

export const commands = new Map<string, Command>();

export function registerCommand(command: Command): void {
  commands.set(command.name, command);
  // Also register aliases if any
  if (command.usage) {
    // Could add aliases here
  }
}

export function getCommand(name: string): Command | undefined {
  return commands.get(name);
}

export function getAllCommands(): Command[] {
  return Array.from(commands.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function formatError(cmd: string, message: string): string {
  return `${cmd}: ${message}`;
}

export function formatNotFound(cmd: string): string {
  return `bash: ${cmd}: command not found`;
}

// Helper to resolve path using VFS
export function resolvePath(path: string): string {
  return vfs.resolvePath(path);
}

// Helper to get current working directory
export function getCwd(): string {
  return vfs.getCwd();
}

// Helper to set current working directory
export function setCwd(path: string): { success: boolean; error?: string } {
  const result = vfs.setCwd(path);
  return { success: result.success, error: result.error };
}