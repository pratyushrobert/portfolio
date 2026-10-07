import { create } from 'zustand';

export type BootPhase =
  | 'powered_off'
  | 'mcorp_splash'
  | 'system_boot'
  | 'mimios_splash'
  | 'login'
  | 'welcome'
  | 'desktop'
  | 'error';

export interface LocalUser {
  name: string;
  type: 'guest/local';
}

interface BootState {
  phase: BootPhase;
  errorMessage: string | null;
  localUser: LocalUser;
  setPhase: (phase: BootPhase) => void;
  setLocalUser: (name: string) => void;
  powerOn: () => void;
  powerOff: () => void;
  logoutToLogin: () => void;
  setError: (msg: string) => void;
}

export const useBootStore = create<BootState>((set) => ({
  phase: 'powered_off',
  errorMessage: null,
  localUser: { name: 'Guest', type: 'guest/local' },
  setPhase: (phase) => set({ phase, errorMessage: null }),
  setLocalUser: (name: string) =>
    set({ localUser: { name: name.trim() || 'Guest', type: 'guest/local' } }),
  powerOn: () => set({ phase: 'mcorp_splash', errorMessage: null }),
  powerOff: () => set({ phase: 'powered_off', errorMessage: null }),
  logoutToLogin: () => set({ phase: 'login', errorMessage: null }),
  setError: (msg) => set({ phase: 'error', errorMessage: msg }),
}));
