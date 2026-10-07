export interface DiscoveryBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export const DISCOVERY_BADGES: DiscoveryBadge[] = [
  { id: 'first_cmd', name: 'Terminal Initiate', description: 'Executed your first terminal command', icon: '💻' },
  { id: 'neofetch', name: 'SysAdmin', description: 'Inspected MimiOS system diagnostics', icon: '📊' },
  { id: 'mimi_cat', name: 'Cat Whispers', description: 'Consulted the Mimi security daemon', icon: '🐱' },
  { id: 'cryptographer', name: 'Cryptographer', description: 'Generated a hash or base64 token', icon: '🔐' },
  { id: 'sim_scan', name: 'Reconnaissance', description: 'Ran the simulated network scanner', icon: '🛰️' },
  { id: 'solved_ctf', name: 'Cyber Researcher', description: 'Solved the hidden cipher challenge', icon: '🚩' },
  { id: 'retro_gamer', name: 'Retro Gamer', description: 'Launched and played Cyber Snake', icon: '🕹️' },
];

const STORAGE_KEY = 'mimios_discoveries';

export function getUnlockedDiscoveries(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function unlockDiscovery(badgeId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const existing = getUnlockedDiscoveries();
    if (!existing.includes(badgeId)) {
      const updated = [...existing, badgeId];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return true; // Newly unlocked
    }
  } catch {
    // Ignore localStorage errors
  }
  return false;
}
