import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DesktopState, DesktopIcon } from '../types/desktop';

const DEFAULT_ICONS: DesktopIcon[] = [
  { id: 'terminal', label: 'Terminal', icon: 'Terminal', x: 40, y: 40, appId: 'terminal' },
  { id: 'files', label: 'Files', icon: 'FolderOpen', x: 40, y: 140, appId: 'files' },
  { id: 'editor', label: 'Editor', icon: 'FileText', x: 40, y: 240, appId: 'editor' },
  { id: 'settings', label: 'Settings', icon: 'Settings', x: 40, y: 340, appId: 'settings' },
];

export const useDesktopStore = create<DesktopState>()(
  persist(
    () => ({
      wallpaper: '',
      icons: DEFAULT_ICONS,
      panelPosition: 'top',
      showPanel: true,
    }),
    { name: 'pratyushos-desktop' }
  )
);

export const useDesktopActions = create((set, get) => ({
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
}));