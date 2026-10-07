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
  restoreWindow: (id: string) => void;
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

  openWindow: (windowConfig) => {
    const id = windowConfig.id;
    const zIndex = get().getNextZIndex();
    const clampedPos = typeof windowConfig.x === 'number' && typeof windowConfig.y === 'number'
      ? {
          x: typeof window !== 'undefined'
            ? Math.max(20, Math.min(windowConfig.x, Math.max(20, window.innerWidth - (windowConfig.width || 600) - 20)))
            : windowConfig.x,
          y: typeof window !== 'undefined'
            ? Math.max(48, Math.min(windowConfig.y, Math.max(48, window.innerHeight - 200)))
            : windowConfig.y,
        }
      : { x: windowConfig.x, y: windowConfig.y };

    const newWindow: WindowState = {
      ...windowConfig,
      x: clampedPos.x,
      y: clampedPos.y,
      zIndex,
      isFocused: true,
    };
    set(state => ({
      windows: state.windows.map(w => ({ ...w, isFocused: false })).concat(newWindow),
      focusedId: id,
    }));
    return id;
  },

  openWindowWithParams: (windowConfig: Omit<WindowState, 'zIndex' | 'isFocused'>, appParams?: Record<string, unknown>) => {
    const id = windowConfig.id;
    const zIndex = get().getNextZIndex();
    const clampedPos = typeof windowConfig.x === 'number' && typeof windowConfig.y === 'number'
      ? {
          x: typeof window !== 'undefined'
            ? Math.max(20, Math.min(windowConfig.x, Math.max(20, window.innerWidth - (windowConfig.width || 600) - 20)))
            : windowConfig.x,
          y: typeof window !== 'undefined'
            ? Math.max(48, Math.min(windowConfig.y, Math.max(48, window.innerHeight - 200)))
            : windowConfig.y,
        }
      : { x: windowConfig.x, y: windowConfig.y };

    const newWindow: WindowState = {
      ...windowConfig,
      x: clampedPos.x,
      y: clampedPos.y,
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
      const remaining = state.windows.filter(w => w.id !== id);
      let newFocusedId = state.focusedId;

      if (state.focusedId === id) {
        const remainingVisible = remaining.filter(w => !w.isMinimized);
        if (remainingVisible.length > 0) {
          const topWindow = remainingVisible.reduce((max, w) => (w.zIndex > max.zIndex ? w : max));
          newFocusedId = topWindow.id;
        } else {
          newFocusedId = null;
        }
      }

      return {
        windows: remaining.map(w => ({
          ...w,
          isFocused: w.id === newFocusedId,
        })),
        focusedId: newFocusedId,
      };
    }),

  minimizeWindow: (id) =>
    set(state => {
      const remainingVisible = state.windows.filter(w => w.id !== id && !w.isMinimized);
      let newFocusedId = state.focusedId;

      if (state.focusedId === id) {
        if (remainingVisible.length > 0) {
          const topWindow = remainingVisible.reduce((max, w) => (w.zIndex > max.zIndex ? w : max));
          newFocusedId = topWindow.id;
        } else {
          newFocusedId = null;
        }
      }

      return {
        windows: state.windows.map(w =>
          w.id === id
            ? { ...w, isMinimized: true, isFocused: false }
            : { ...w, isFocused: w.id === newFocusedId }
        ),
        focusedId: newFocusedId,
      };
    }),

  maximizeWindow: (id) =>
    set(state => ({
      windows: state.windows.map(w =>
        w.id === id ? { ...w, isMaximized: !w.isMaximized } : w
      ),
    })),

  restoreWindow: (id) =>
    set(state => {
      const window = state.windows.find(w => w.id === id);
      if (!window) return state;

      const zIndex = get().getNextZIndex();
      return {
        windows: state.windows.map(w =>
          w.id === id
            ? { ...w, isMinimized: false, isFocused: true, zIndex }
            : { ...w, isFocused: false }
        ),
        focusedId: id,
      };
    }),

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