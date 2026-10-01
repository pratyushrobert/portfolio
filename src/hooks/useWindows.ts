import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WindowInstance, WindowState, AppId, APP_CONFIGS } from '../types/window';

interface WindowStore {
  windows: Record<string, WindowInstance>;
  zIndexCounter: number;
  focusedWindowId: string | null;
  minimizedOrder: string[]; // Order for taskbar

  openWindow: (appId: AppId, props?: Record<string, unknown>) => string;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  updateWindowPosition: (id: string, x: number, y: number) => void;
  updateWindowSize: (id: string, width: number, height: number) => void;
  setWindowState: (id: string, state: WindowState) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  getNextZIndex: () => number;
  isWindowOpen: (appId: AppId) => boolean;
  getWindowInstance: (id: string) => WindowInstance | undefined;
}

const DEFAULT_POSITIONS: Record<string, { x: number; y: number }> = {};
let positionCounter = 0;

function getDefaultPosition(appId: AppId): { x: number; y: number } {
  const key = appId;
  if (!DEFAULT_POSITIONS[key]) {
    const offset = (positionCounter % 5) * 30;
    DEFAULT_POSITIONS[key] = { x: 100 + offset, y: 100 + offset };
    positionCounter++;
  }
  return DEFAULT_POSITIONS[key];
}

export const useWindowStore = create<WindowStore>()(
  persist(
    (set, get) => ({
      windows: {},
      zIndexCounter: 100,
      focusedWindowId: null,
      minimizedOrder: [],

      openWindow: (appId, props) => {
        const config = APP_CONFIGS[appId];
        const existing = Object.values(get().windows).find((w) => w.id === appId && w.state !== 'minimized');
        if (existing) {
          get().focusWindow(existing.id);
          return existing.id;
        }

        const minimized = Object.values(get().windows).find((w) => w.id === appId && w.state === 'minimized');
        if (minimized) {
          get().restoreWindow(minimized.id);
          return minimized.id;
        }

        const pos = getDefaultPosition(appId);
        const newZIndex = get().getNextZIndex();
        const instance: WindowInstance = {
          ...config,
          props,
          state: 'normal',
          zIndex: newZIndex,
          x: config.defaultX ?? pos.x,
          y: config.defaultY ?? pos.y,
          width: config.defaultWidth ?? 800,
          height: config.defaultHeight ?? 500,
          isFocused: true,
        };

        set((state) => ({
          windows: { ...state.windows, [appId]: instance },
          focusedWindowId: appId,
          minimizedOrder: state.minimizedOrder.filter((id) => id !== appId),
        }));

        return appId;
      },

      closeWindow: (id) =>
        set((state) => {
          const { [id]: closed, ...rest } = state.windows;
          return {
            windows: rest,
            focusedWindowId: state.focusedWindowId === id ? null : state.focusedWindowId,
            minimizedOrder: state.minimizedOrder.filter((w) => w !== id),
          };
        }),

      minimizeWindow: (id) =>
        set((state) => {
          const window = state.windows[id];
          if (!window || window.state === 'minimized') return state;

          return {
            windows: {
              ...state.windows,
              [id]: { ...window, state: 'minimized', isFocused: false },
            },
            focusedWindowId: state.focusedWindowId === id ? null : state.focusedWindowId,
            minimizedOrder: [...state.minimizedOrder.filter((w) => w !== id), id],
          };
        }),

      maximizeWindow: (id) =>
        set((state) => {
          const window = state.windows[id];
          if (!window || window.state === 'maximized') return state;

          return {
            windows: {
              ...state.windows,
              [id]: {
                ...window,
                state: 'maximized',
                previousX: window.x,
                previousY: window.y,
                previousWidth: window.width,
                previousHeight: window.height,
                x: 0,
                y: 0,
                width: window.innerWidth || window.screenX,
                height: window.innerHeight || window.screenY,
              },
            },
          };
        }),

      restoreWindow: (id) =>
        set((state) => {
          const window = state.windows[id];
          if (!window || window.state === 'normal') return state;

          return {
            windows: {
              ...state.windows,
              [id]: {
                ...window,
                state: 'normal',
                x: window.previousX ?? window.x,
                y: window.previousY ?? window.y,
                width: window.previousWidth ?? window.width,
                height: window.previousHeight ?? window.height,
                previousX: undefined,
                previousY: undefined,
                previousWidth: undefined,
                previousHeight: undefined,
              },
            },
            minimizedOrder: state.minimizedOrder.filter((w) => w !== id),
          };
        }),

      focusWindow: (id) =>
        set((state) => {
          const window = state.windows[id];
          if (!window) return state;

          const newZIndex = state.getNextZIndex();
          return {
            windows: {
              ...state.windows,
              [id]: { ...window, isFocused: true, zIndex: newZIndex },
            },
            focusedWindowId: id,
            minimizedOrder: state.minimizedOrder.filter((w) => w !== id),
          };
        }),

      updateWindowPosition: (id, x, y) =>
        set((state) => {
          const window = state.windows[id];
          if (!window || window.state === 'maximized') return state;
          return {
            windows: { ...state.windows, [id]: { ...window, x, y } },
          };
        }),

      updateWindowSize: (id, width, height) =>
        set((state) => {
          const window = state.windows[id];
          if (!window || window.state === 'maximized') return state;
          return {
            windows: { ...state.windows, [id]: { ...window, width, height } },
          };
        }),

      setWindowState: (id, windowState) =>
        set((state) => {
          const window = state.windows[id];
          if (!window) return state;
          return {
            windows: { ...state.windows, [id]: { ...window, state: windowState } },
          };
        }),

      bringToFront: (id) =>
        set((state) => {
          const window = state.windows[id];
          if (!window) return state;
          const newZIndex = state.getNextZIndex();
          return {
            windows: { ...state.windows, [id]: { ...window, zIndex: newZIndex, isFocused: true } },
            focusedWindowId: id,
          };
        }),

      sendToBack: (id) =>
        set((state) => {
          const window = state.windows[id];
          if (!window) return state;
          return {
            windows: { ...state.windows, [id]: { ...window, zIndex: 100, isFocused: false } },
            focusedWindowId: state.focusedWindowId === id ? null : state.focusedWindowId,
          };
        }),

      getNextZIndex: () => {
        const state = get();
        return ++state.zIndexCounter;
      },

      isWindowOpen: (appId) => {
        const state = get();
        return !!state.windows[appId];
      },

      getWindowInstance: (id) => {
        return get().windows[id];
      },
    }),
    {
      name: 'pratyushos-windows',
      partialize: (state) => ({
        windows: Object.fromEntries(
          Object.entries(state.windows).map(([k, v]) => [
            k,
            {
              ...v,
              isFocused: false,
              zIndex: v.zIndex,
            },
          ])
        ),
      }),
    }
  )
);