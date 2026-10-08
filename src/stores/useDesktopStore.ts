import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DesktopState, DesktopIcon, PanelPosition, PanelStyle } from '../types/desktop';

export const GRID_COL_WIDTH = 112;
export const GRID_ROW_HEIGHT = 104;
export const GRID_TILE_WIDTH = 96;
export const GRID_TILE_HEIGHT = 100;
export const GRID_START_X = 24;
export const GRID_START_Y = 56;
export const GRID_PANEL_BOTTOM_START_Y = 24;

export function getGridStartX(panelPosition: PanelPosition = 'top'): number {
  return panelPosition === 'left' ? 68 : GRID_START_X;
}

export function getGridStartY(panelPosition: PanelPosition = 'top'): number {
  return panelPosition === 'top' ? GRID_START_Y : GRID_PANEL_BOTTOM_START_Y;
}

export function gridColToX(col: number, panelPosition: PanelPosition = 'top'): number {
  return getGridStartX(panelPosition) + col * GRID_COL_WIDTH;
}

export function gridRowToY(row: number, panelPosition: PanelPosition = 'top'): number {
  return getGridStartY(panelPosition) + row * GRID_ROW_HEIGHT;
}

export function xToGridCol(x: number, panelPosition: PanelPosition = 'top'): number {
  return Math.round((x - getGridStartX(panelPosition)) / GRID_COL_WIDTH);
}

export function yToGridRow(y: number, panelPosition: PanelPosition = 'top'): number {
  return Math.round((y - getGridStartY(panelPosition)) / GRID_ROW_HEIGHT);
}

export function snapToGrid(
  x: number,
  y: number,
  panelPosition: PanelPosition = 'top'
): { x: number; y: number; col: number; row: number } {
  const col = Math.max(0, xToGridCol(x, panelPosition));
  const row = Math.max(0, yToGridRow(y, panelPosition));
  return {
    col,
    row,
    x: gridColToX(col, panelPosition),
    y: gridRowToY(row, panelPosition),
  };
}

export function findNearestFreeCell(
  icons: DesktopIcon[],
  startCol: number,
  startRow: number,
  excludeId?: string
): { col: number; row: number } {
  const occupied = new Set<string>();
  for (const i of icons) {
    if (i.id !== excludeId) {
      const c = typeof i.col === 'number' ? i.col : xToGridCol(i.x);
      const r = typeof i.row === 'number' ? i.row : yToGridRow(i.y);
      occupied.add(`${c},${r}`);
    }
  }

  if (!occupied.has(`${startCol},${startRow}`)) {
    return { col: startCol, row: startRow };
  }

  // Search in rings of increasing Manhattan distance
  for (let dist = 1; dist < 25; dist++) {
    for (let dc = -dist; dc <= dist; dc++) {
      for (let dr = -dist; dr <= dist; dr++) {
        if (Math.abs(dc) + Math.abs(dr) !== dist) continue;
        const candCol = startCol + dc;
        const candRow = startRow + dr;
        if (candCol >= 0 && candRow >= 0) {
          const key = `${candCol},${candRow}`;
          if (!occupied.has(key)) {
            return { col: candCol, row: candRow };
          }
        }
      }
    }
  }

  return { col: startCol + 1, row: startRow };
}

export const DEFAULT_ICONS: DesktopIcon[] = [
  { id: 'terminal', label: 'Terminal', icon: 'terminal', appId: 'terminal', col: 0, row: 0, x: 0, y: 0 },
  { id: 'about', label: 'About Me', icon: 'about', appId: 'about', col: 0, row: 1, x: 0, y: 0 },
];

export function sanitizeIconGrid(
  icons: DesktopIcon[],
  panelPosition: PanelPosition = 'top'
): DesktopIcon[] {
  // Map existing icons by appId or id
  const iconMap = new Map<string, DesktopIcon>();
  for (const icon of icons) {
    const key = icon.appId || icon.id;
    iconMap.set(key, icon);
  }

  // Ensure all DEFAULT_ICONS are present
  const merged: DesktopIcon[] = [];
  for (const def of DEFAULT_ICONS) {
    const key = def.appId || def.id;
    if (iconMap.has(key)) {
      const existing = iconMap.get(key)!;
      merged.push({
        ...def,
        ...existing,
        col: typeof existing.col === 'number' ? existing.col : def.col,
        row: typeof existing.row === 'number' ? existing.row : def.row,
      });
    } else {
      merged.push({ ...def });
    }
  }

  // Include any extra user icons
  for (const [key, icon] of iconMap.entries()) {
    if (!DEFAULT_ICONS.some(def => (def.appId || def.id) === key)) {
      merged.push(icon);
    }
  }

  const occupied = new Set<string>();
  const sanitized: DesktopIcon[] = [];

  for (const icon of merged) {
    let col = typeof icon.col === 'number' ? icon.col : xToGridCol(icon.x, panelPosition);
    let row = typeof icon.row === 'number' ? icon.row : yToGridRow(icon.y, panelPosition);

    col = Math.max(0, col);
    row = Math.max(0, row);

    const cellKey = `${col},${row}`;
    if (!occupied.has(cellKey)) {
      occupied.add(cellKey);
      sanitized.push({
        ...icon,
        col,
        row,
        x: gridColToX(col, panelPosition),
        y: gridRowToY(row, panelPosition),
      });
    } else {
      const free = findNearestFreeCell(sanitized, col, row);
      occupied.add(`${free.col},${free.row}`);
      sanitized.push({
        ...icon,
        col: free.col,
        row: free.row,
        x: gridColToX(free.col, panelPosition),
        y: gridRowToY(free.row, panelPosition),
      });
    }
  }

  return sanitized;
}

function applyGlassBlurProperty(blur: number): void {
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--glass-blur-radius', `${blur}px`);
  }
}

type DesktopStore = DesktopState & {
  setWallpaper: (wallpaper: string) => void;
  setGlassBlur: (glassBlur: number) => void;
  setBackgroundConfig: (config: {
    wallpaper?: string;
    wallpaperPosition?: string;
    wallpaperSize?: string;
    wallpaperOverlay?: string;
    wallpaperColor?: string;
    wallpaperBrightness?: number;
    wallpaperOverlayOpacity?: number;
    glassBlur?: number;
  }) => void;
  setIcons: (icons: DesktopIcon[]) => void;
  addIcon: (icon: DesktopIcon) => void;
  removeIcon: (id: string) => void;
  updateIconPosition: (id: string, x: number, y: number) => void;
  moveIconWithCollision: (
    id: string,
    targetXOrCol: number,
    targetYOrRow: number,
    originXOrCol?: number,
    originYOrRow?: number
  ) => void;
  arrangeIcons: () => void;
  snapIconsToGrid: () => void;
  resetIconPosition: (id: string) => void;
  resetIconPositions: () => void;
  setPanelPosition: (position: PanelPosition) => void;
  setPanelStyle: (style: PanelStyle) => void;
  togglePanel: () => void;
  setWallpaperBrightness: (brightness: number) => void;
  setSystemVolume: (volume: number) => void;
  toggleSystemMute: () => void;
  setWifiEnabled: (enabled: boolean) => void;
  setBluetoothEnabled: (enabled: boolean) => void;
  setAirplaneMode: (enabled: boolean) => void;
};

export const useDesktopStore = create<DesktopStore>()(
  persist(
    (set, get) => ({
      wallpaper: '',
      wallpaperPosition: 'center',
      wallpaperSize: 'cover',
      wallpaperOverlay: 'rgba(0, 0, 0, 0.3)',
      wallpaperColor: '#08090d',
      wallpaperBrightness: 100,
      wallpaperOverlayOpacity: 30,
      glassBlur: 5,
      icons: DEFAULT_ICONS,
      panelPosition: 'top' as PanelPosition,
      panelStyle: 'floating' as PanelStyle,
      showPanel: true,
      systemVolume: 80,
      systemMuted: false,
      wifiEnabled: typeof navigator !== 'undefined' ? navigator.onLine : true,
      bluetoothEnabled: true,
      airplaneMode: false,

      setWallpaper: (wallpaper: string) => set({ wallpaper }),
      setGlassBlur: (glassBlur: number) => {
        const normalized = Math.min(30, Math.max(0, isNaN(glassBlur) ? 5 : glassBlur));
        applyGlassBlurProperty(normalized);
        set({ glassBlur: normalized });
      },
      setWallpaperBrightness: (wallpaperBrightness: number) => set({ wallpaperBrightness }),
      setSystemVolume: (systemVolume: number) => set({ systemVolume, systemMuted: false }),
      toggleSystemMute: () => set(state => ({ systemMuted: !state.systemMuted })),
      setWifiEnabled: (wifiEnabled: boolean) =>
        set(state => ({
          wifiEnabled,
          airplaneMode: !wifiEnabled && !state.bluetoothEnabled ? true : state.airplaneMode,
        })),
      setBluetoothEnabled: (bluetoothEnabled: boolean) =>
        set(state => ({
          bluetoothEnabled,
          airplaneMode: !bluetoothEnabled && !state.wifiEnabled ? true : state.airplaneMode,
        })),
      setAirplaneMode: (airplaneMode: boolean) =>
        set(() => {
          if (airplaneMode) {
            return {
              airplaneMode: true,
              wifiEnabled: false,
              bluetoothEnabled: false,
            };
          }
          return {
            airplaneMode: false,
            wifiEnabled: typeof navigator !== 'undefined' ? navigator.onLine : true,
            bluetoothEnabled: true,
          };
        }),
      setBackgroundConfig: (config) => {
        if (config.glassBlur !== undefined) {
          const normalized = Math.min(30, Math.max(0, isNaN(config.glassBlur) ? 5 : config.glassBlur));
          applyGlassBlurProperty(normalized);
        }
        return set((state) => ({
          wallpaper: config.wallpaper !== undefined ? config.wallpaper : state.wallpaper,
          wallpaperPosition: config.wallpaperPosition !== undefined ? config.wallpaperPosition : state.wallpaperPosition,
          wallpaperSize: config.wallpaperSize !== undefined ? config.wallpaperSize : state.wallpaperSize,
          wallpaperOverlay: config.wallpaperOverlay !== undefined ? config.wallpaperOverlay : state.wallpaperOverlay,
          wallpaperColor: config.wallpaperColor !== undefined && config.wallpaperColor !== '#1a1a2e' ? config.wallpaperColor : (state.wallpaperColor === '#1a1a2e' ? '#08090d' : state.wallpaperColor),
          wallpaperBrightness: config.wallpaperBrightness !== undefined ? config.wallpaperBrightness : (state.wallpaperBrightness ?? 100),
          wallpaperOverlayOpacity: config.wallpaperOverlayOpacity !== undefined ? config.wallpaperOverlayOpacity : (state.wallpaperOverlayOpacity ?? 30),
          glassBlur: config.glassBlur !== undefined ? Math.min(30, Math.max(0, isNaN(config.glassBlur) ? 5 : config.glassBlur)) : (state.glassBlur ?? 5),
        }));
      },
      setIcons: (icons: DesktopIcon[]) => set({ icons }),
      addIcon: (icon: DesktopIcon) => set({ icons: [...get().icons, icon] }),
      removeIcon: (id: string) => set({ icons: get().icons.filter(i => i.id !== id) }),

      updateIconPosition: (id: string, x: number, y: number) => {
        const panelPos = get().panelPosition;
        const col = Math.max(0, xToGridCol(x));
        const row = Math.max(0, yToGridRow(y, panelPos));
        set({
          icons: get().icons.map(i =>
            i.id === id
              ? {
                  ...i,
                  col,
                  row,
                  x: gridColToX(col),
                  y: gridRowToY(row, panelPos),
                }
              : i
          ),
        });
      },

      moveIconWithCollision: (
        id: string,
        targetXOrCol: number,
        targetYOrRow: number,
        originXOrCol?: number,
        originYOrRow?: number
      ) => {
        const panelPos = get().panelPosition;

        // If inputs are large (> 20), treat them as pixel coords and convert; else treat as grid coords
        const isPixelTarget = targetXOrCol > 20 || targetYOrRow > 20;
        const targetCol = isPixelTarget ? Math.max(0, xToGridCol(targetXOrCol)) : Math.max(0, targetXOrCol);
        const targetRow = isPixelTarget ? Math.max(0, yToGridRow(targetYOrRow, panelPos)) : Math.max(0, targetYOrRow);

        const currentIcons = get().icons;
        const movingIcon = currentIcons.find(i => i.id === id);
        if (!movingIcon) return;

        const originCol = typeof movingIcon.col === 'number'
          ? movingIcon.col
          : (originXOrCol !== undefined && originXOrCol > 20 ? xToGridCol(originXOrCol) : (originXOrCol ?? xToGridCol(movingIcon.x)));
        const originRow = typeof movingIcon.row === 'number'
          ? movingIcon.row
          : (originYOrRow !== undefined && originYOrRow > 20 ? yToGridRow(originYOrRow, panelPos) : (originYOrRow ?? yToGridRow(movingIcon.y, panelPos)));

        // If dropped in identical cell, re-sync exact pixel coordinates and return
        if (targetCol === originCol && targetRow === originRow) {
          set({
            icons: currentIcons.map(icon =>
              icon.id === id
                ? {
                    ...icon,
                    col: targetCol,
                    row: targetRow,
                    x: gridColToX(targetCol),
                    y: gridRowToY(targetRow, panelPos),
                  }
                : icon
            ),
          });
          return;
        }

        // Check whether target grid cell is occupied by another icon
        const targetOccupant = currentIcons.find(
          i => i.id !== id &&
          (typeof i.col === 'number' ? i.col === targetCol : xToGridCol(i.x) === targetCol) &&
          (typeof i.row === 'number' ? i.row === targetRow : yToGridRow(i.y, panelPos) === targetRow)
        );

        if (targetOccupant) {
          // Verify if swapping with the vacated origin cell causes any conflict
          const originConflict = currentIcons.some(
            i => i.id !== id && i.id !== targetOccupant.id &&
            (typeof i.col === 'number' ? i.col === originCol : xToGridCol(i.x) === originCol) &&
            (typeof i.row === 'number' ? i.row === originRow : yToGridRow(i.y, panelPos) === originRow)
          );

          if (!originConflict) {
            // Swap positions cleanly
            set({
              icons: currentIcons.map(icon => {
                if (icon.id === id) {
                  return {
                    ...icon,
                    col: targetCol,
                    row: targetRow,
                    x: gridColToX(targetCol),
                    y: gridRowToY(targetRow, panelPos),
                  };
                }
                if (icon.id === targetOccupant.id) {
                  return {
                    ...icon,
                    col: originCol,
                    row: originRow,
                    x: gridColToX(originCol),
                    y: gridRowToY(originRow, panelPos),
                  };
                }
                return icon;
              }),
            });
          } else {
            // Find nearest free cell for the dropped icon
            const free = findNearestFreeCell(currentIcons, targetCol, targetRow, id);
            set({
              icons: currentIcons.map(icon =>
                icon.id === id
                  ? {
                      ...icon,
                      col: free.col,
                      row: free.row,
                      x: gridColToX(free.col),
                      y: gridRowToY(free.row, panelPos),
                    }
                  : icon
              ),
            });
          }
        } else {
          // Place directly into unoccupied grid cell
          set({
            icons: currentIcons.map(icon =>
              icon.id === id
                ? {
                    ...icon,
                    col: targetCol,
                    row: targetRow,
                    x: gridColToX(targetCol),
                    y: gridRowToY(targetRow, panelPos),
                  }
                : icon
            ),
          });
        }
      },

      arrangeIcons: () => {
        const panelPos = get().panelPosition;
        const orderMap = new Map(DEFAULT_ICONS.map((def, idx) => [def.appId || def.id, idx]));
        const sorted = [...get().icons].sort((a, b) => {
          const orderA = orderMap.has(a.appId || a.id) ? orderMap.get(a.appId || a.id)! : 999;
          const orderB = orderMap.has(b.appId || b.id) ? orderMap.get(b.appId || b.id)! : 999;
          return orderA - orderB;
        });

        const assigned: DesktopIcon[] = [];

        // 1. Assign default icons to their authoritative col & row
        for (const def of DEFAULT_ICONS) {
          const icon = sorted.find(i => (i.appId || i.id) === (def.appId || def.id));
          if (icon) {
            const targetCol = def.col ?? 0;
            const targetRow = def.row ?? 0;
            assigned.push({
              ...icon,
              col: targetCol,
              row: targetRow,
              x: gridColToX(targetCol),
              y: gridRowToY(targetRow, panelPos),
            });
          }
        }

        // 2. Assign any extra custom icons to nearest free cells
        for (const icon of sorted) {
          if (!assigned.some(a => a.id === icon.id)) {
            const free = findNearestFreeCell(assigned, 2, 0);
            assigned.push({
              ...icon,
              col: free.col,
              row: free.row,
              x: gridColToX(free.col),
              y: gridRowToY(free.row, panelPos),
            });
          }
        }

        set({ icons: assigned });
      },

      snapIconsToGrid: () => {
        const panelPos = get().panelPosition;
        set({
          icons: sanitizeIconGrid(get().icons, panelPos),
        });
      },

      resetIconPosition: (id: string) => {
        const def = DEFAULT_ICONS.find(d => d.id === id || d.appId === id);
        if (!def) return;
        get().moveIconWithCollision(id, def.col ?? 0, def.row ?? 0);
      },

      resetIconPositions: () => {
        get().arrangeIcons();
      },

      setPanelPosition: (position: PanelPosition) => {
        set(state => ({
          panelPosition: position,
          icons: state.icons.map(icon => {
            const col = typeof icon.col === 'number' ? icon.col : xToGridCol(icon.x, state.panelPosition);
            const row = typeof icon.row === 'number' ? icon.row : yToGridRow(icon.y, state.panelPosition);
            return {
              ...icon,
              col,
              row,
              x: gridColToX(col, position),
              y: gridRowToY(row, position),
            };
          }),
        }));
      },
      setPanelStyle: (panelStyle: PanelStyle) => set({ panelStyle }),
      togglePanel: () => set({ showPanel: !get().showPanel }),
    }),
    {
      name: 'pratyushos-desktop',
      version: 5,
      migrate: (persistedState: any, version: number) => {
        if (!persistedState || version < 5) {
          return {
            ...persistedState,
            icons: DEFAULT_ICONS,
          };
        }
        return persistedState;
      },
    }
  )
);

// Re-export for backwards compatibility
export const useDesktopActions = useDesktopStore;