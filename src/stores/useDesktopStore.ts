import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DesktopState, DesktopIcon } from '../types/desktop';

const DEFAULT_ICONS: DesktopIcon[] = [
  { id: 'terminal', label: 'Terminal', icon: 'Terminal', x: 40, y: 40, appId: 'terminal' },
  { id: 'files', label: 'Files', icon: 'FolderOpen', x: 40, y: 140, appId: 'files' },
  { id: 'editor', label: 'Editor', icon: 'FileText', x: 40, y: 240, appId: 'editor' },
  { id: 'settings', label: 'Settings', icon: 'Settings', x: 40, y: 340, appId: 'settings' },
];

type DesktopStore = DesktopState & {
  setWallpaper: (wallpaper: string) => void;
  setIcons: (icons: DesktopIcon[]) => void;
  addIcon: (icon: DesktopIcon) => void;
  removeIcon: (id: string) => void;
  updateIconPosition: (id: string, x: number, y: number) => void;
  setPanelPosition: (position: 'top' | 'bottom') => void;
  togglePanel: () => void;
};

export const useDesktopStore = create<DesktopStore>()(
  persist(
    (set, get) => ({
      wallpaper: '',
      icons: DEFAULT_ICONS,
      panelPosition: 'top' as const,
      showPanel: true,

      setWallpaper: (wallpaper: string) => set({ wallpaper }),
      setIcons: (icons: DesktopIcon[]) => set({ icons }),
      addIcon: (icon: DesktopIcon) => set({ icons: [...get().icons, icon] }),
      removeIcon: (id: string) => set({ icons: get().icons.filter(i => i.id !== id) }),
      updateIconPosition: (id: string, x: number, y: number) =>
        set({
          icons: get().icons.map(i => (i.id === id ? { ...i, x, y } : i)),
        }),
      setPanelPosition: (position: 'top' | 'bottom') => set({ panelPosition: position }),
      togglePanel: () => set({ showPanel: !get().showPanel }),
    }),
    { name: 'pratyushos-desktop' }
  )
);

// Re-export for backwards compatibility
export const useDesktopActions = useDesktopStore;