import type { VFSState } from '../../types/vfs';

const STORAGE_KEY = 'mimios-vfs';
const VERSION_KEY = 'mimios-vfs-version';
const CURRENT_VERSION = 1;

export function saveToLocalStorage(state: VFSState): void {
  try {
    const data = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, data);
    localStorage.setItem(VERSION_KEY, String(CURRENT_VERSION));
  } catch (error) {
    console.error('Failed to save VFS to localStorage:', error);
  }
}

export function loadFromLocalStorage(): VFSState | null {
  try {
    const version = localStorage.getItem(VERSION_KEY);
    if (version !== String(CURRENT_VERSION)) {
      return null;
    }
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    return JSON.parse(data) as VFSState;
  } catch (error) {
    console.error('Failed to load VFS from localStorage:', error);
    return null;
  }
}

export function clearLocalStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(VERSION_KEY);
}