import { create } from 'zustand';
import type { WindowState } from '../types/desktop';

let zIndexCounter = 1000;

interface WindowStoreState {
  windows: WindowState[];
  focusedId: string | null;
  openWindow: (window: Omit<WindowState, 'zIndex' | 'isFocused'>) => string;
  openWindowWithParams: (window: Omit<WindowState, 'zIndex' | 'isFocused'>, appParams?: Record<string, unknown>) => string;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  updateWindowPosition: (id: string, x: number, y: number) => void;
  updateWindowSize: (id: string, width: number, height: number) => void;
  updateWindowState: (id: string, state: Partial<WindowState>) => void;
  getNextZIndex: () => number;
  getWindow: (id: string) => WindowState | undefined;
  getOpenWindows: () => WindowState[];
  getMinimizedWindows: () => WindowState[];
}

export const useWindowStore = create<WindowStoreState>((set, get) => ({
  windows: [],
  focusedId: null,

  getNextZIndex: () => ++zIndexCounter,

  openWindow: (window) => {
    const id = window.id;
    const zIndex = get().getNextZIndex();
    const newWindow: WindowState = {
      ...window,
      zIndex,
      isFocused: true,
    };
    set(state => ({
      windows: state.windows.map(w => ({ ...w, isFocused: false })).concat(newWindow),
      focusedId: id,
    }));
    return id;
  },

  openWindowWithParams: (window: Omit<WindowState, 'zIndex' | 'isFocused'>, appParams?: Record<string, unknown>) => {
    const id = window.id;
    const zIndex = get().getNextZIndex();
    const newWindow: WindowState = {
      ...window,
      zIndex,
      isFocused: true,
      appParams,
    };
    set(state => ({
      windows: state.windows.map(w => ({ ...w, isFocused: false })).concat(newWindow),
      focusedId: id,
    }));
    return id;
  },

  closeWindow: (id) =>
    set(state => {
      const window = state.windows.find(w => w.id === id);
      const wasFocused = window?.isFocused;
      const remaining = state.windows.filter(w => w.id !== id);
      let newFocusedId = state.focusedId;

      if (wasFocused && remaining.length > 0) {
        const topWindow = remaining.reduce((max, w) => (w.zIndex > max.zIndex ? w : max));
        newFocusedId = topWindow.id;
        remaining.forEach(w => (w.isFocused = w.id === newFocusedId));
      }

      return { windows: remaining, focusedId: newFocusedId };
    }),

  minimizeWindow: (id) =>
    set(state => ({
      windows: state.windows.map(w =>
        w.id === id ? { ...w, isMinimized: true, isFocused: false } : w
      ),
      focusedId: state.focusedId === id ? null : state.focusedId,
    })),

  maximizeWindow: (id) =>
    set(state => ({
      windows: state.windows.map(w =>
        w.id === id ? { ...w, isMaximized: !w.isMaximized } : w
      ),
    })),

  focusWindow: (id) =>
    set(state => {
      const window = state.windows.find(w => w.id === id);
      if (!window || window.isMinimized) return state;

      const zIndex = get().getNextZIndex();
      return {
        windows: state.windows.map(w => ({
          ...w,
          isFocused: w.id === id,
          zIndex: w.id === id ? zIndex : w.zIndex,
        })),
        focusedId: id,
      };
    }),

  updateWindowPosition: (id, x, y) =>
    set(state => ({
      windows: state.windows.map(w =>
        w.id === id && !w.isMaximized ? { ...w, x, y } : w
      ),
    })),

  updateWindowSize: (id, width, height) =>
    set(state => ({
      windows: state.windows.map(w =>
        w.id === id && !w.isMaximized ? { ...w, width, height } : w
      ),
    })),

  updateWindowState: (id, partialState) =>
    set(state => ({
      windows: state.windows.map(w =>
        w.id === id ? { ...w, ...partialState } : w
      ),
    })),

  getWindow: (id) => get().windows.find(w => w.id === id),

  getOpenWindows: () => get().windows.filter(w => !w.isMinimized),

  getMinimizedWindows: () => get().windows.filter(w => w.isMinimized),
}));