import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Wallpaper {
  id: string;
  name: string;
  url: string; // data URL or external URL
  type: 'builtin' | 'custom';
  thumbnail?: string;
}

interface WallpaperState {
  wallpapers: Wallpaper[];
  currentWallpaperId: string | null;
  slideshowEnabled: boolean;
  slideshowInterval: number; // minutes

  addWallpaper: (wallpaper: Omit<Wallpaper, 'id'>) => string;
  removeWallpaper: (id: string) => void;
  setCurrentWallpaper: (id: string) => void;
  setSlideshow: (enabled: boolean, interval?: number) => void;
  getCurrentWallpaper: () => Wallpaper | null;
  getNextWallpaper: () => Wallpaper | null;
}

// Built-in wallpapers (using CSS gradients as placeholders)
const BUILTIN_WALLPAPERS: Omit<Wallpaper, 'id'>[] = [
  {
    name: 'Default',
    url: 'linear-gradient(135deg, #1e1e2e 0%, #313244 50%, #1e1e2e 100%)',
    type: 'builtin',
  },
  {
    name: 'Ocean',
    url: 'linear-gradient(135deg, #0c4a6e 0%, #075985 50%, #0369a1 100%)',
    type: 'builtin',
  },
  {
    name: 'Forest',
    url: 'linear-gradient(135deg, #14532d 0%, #166534 50%, #15803d 100%)',
    type: 'builtin',
  },
  {
    name: 'Sunset',
    url: 'linear-gradient(135deg, #9a3412 0%, #c2410c 50%, #ea580c 100%)',
    type: 'builtin',
  },
  {
    name: 'Night',
    url: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
    type: 'builtin',
  },
];

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export const useWallpaperStore = create<WallpaperState>()(
  persist(
    (set, get) => ({
      wallpapers: [],
      currentWallpaperId: null,
      slideshowEnabled: false,
      slideshowInterval: 30,

      addWallpaper: (wallpaper) => {
        const id = generateId();
        const newWallpaper = { ...wallpaper, id };
        set((state) => ({
          wallpapers: [...state.wallpapers, newWallpaper],
        }));
        return id;
      },

      removeWallpaper: (id) =>
        set((state) => {
          const newWallpapers = state.wallpapers.filter((w) => w.id !== id);
          let newCurrentId = state.currentWallpaperId;
          if (state.currentWallpaperId === id) {
            newCurrentId = newWallpapers[0]?.id || null;
          }
          return {
            wallpapers: newWallpapers,
            currentWallpaperId: newCurrentId,
          };
        }),

      setCurrentWallpaper: (id) =>
        set((state) => {
          const wallpaper = state.wallpapers.find((w) => w.id === id);
          if (!wallpaper) return state;
          return { currentWallpaperId: id };
        }),

      setSlideshow: (enabled, interval = 30) =>
        set({ slideshowEnabled: enabled, slideshowInterval: interval }),

      getCurrentWallpaper: () => {
        const state = get();
        if (!state.currentWallpaperId) {
          // Return first builtin as default
          const builtin = state.wallpapers.find((w) => w.type === 'builtin');
          return builtin || BUILTIN_WALLPAPERS[0] as Wallpaper;
        }
        return state.wallpapers.find((w) => w.id === state.currentWallpaperId) || null;
      },

      getNextWallpaper: () => {
        const state = get();
        const currentIndex = state.wallpapers.findIndex((w) => w.id === state.currentWallpaperId);
        if (currentIndex === -1) return state.wallpapers[0] || null;
        const nextIndex = (currentIndex + 1) % state.wallpapers.length;
        return state.wallpapers[nextIndex];
      },
    }),
    {
      name: 'pratyushos-wallpaper',
      onRehydrateStorage: () => (state) => {
        if (state && state.wallpapers.length === 0) {
          // Initialize with built-in wallpapers
          const builtins = BUILTIN_WALLPAPERS.map((w) => ({
            ...w,
            id: generateId(),
          }));
          state.wallpapers = builtins;
          state.currentWallpaperId = builtins[0].id;
        }
      },
    }
  )
);