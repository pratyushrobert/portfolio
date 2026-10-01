import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useWallpaperStore } from '../../hooks/useWallpaper';
import type { Wallpaper } from '../../hooks/useWallpaper';

interface WallpaperContextType {
  currentWallpaper: Wallpaper | null;
  wallpapers: Wallpaper[];
  setCurrentWallpaper: (id: string) => void;
  addWallpaper: (wallpaper: Omit<Wallpaper, 'id'>) => string;
  removeWallpaper: (id: string) => void;
  slideshowEnabled: boolean;
  setSlideshow: (enabled: boolean, interval?: number) => void;
}

const WallpaperContext = createContext<WallpaperContextType | null>(null);

export const WallpaperProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const {
    wallpapers,
    currentWallpaperId,
    slideshowEnabled,
    slideshowInterval,
    setCurrentWallpaper,
    addWallpaper,
    removeWallpaper,
    setSlideshow,
    getCurrentWallpaper,
    getNextWallpaper,
  } = useWallpaperStore();

  const [currentWallpaper, setCurrentWallpaperState] = useState<Wallpaper | null>(null);

  // Initialize current wallpaper
  useEffect(() => {
    const wp = getCurrentWallpaper();
    if (wp) setCurrentWallpaperState(wp);
  }, [wallpapers, currentWallpaperId, getCurrentWallpaper]);

  // Handle slideshow
  useEffect(() => {
    if (!slideshowEnabled) return;

    const interval = setInterval(() => {
      const next = getNextWallpaper();
      if (next) {
        setCurrentWallpaper(next.id);
        setCurrentWallpaperState(next);
      }
    }, slideshowInterval * 60 * 1000);

    return () => clearInterval(interval);
  }, [slideshowEnabled, slideshowInterval, getNextWallpaper]);

  // Apply wallpaper to document
  useEffect(() => {
    if (!currentWallpaper) return;

    const root = document.documentElement;
    if (currentWallpaper.url.startsWith('linear-gradient') || currentWallpaper.url.startsWith('radial-gradient')) {
      root.style.setProperty('--wallpaper', currentWallpaper.url);
      root.style.setProperty('--wallpaper-type', 'gradient');
    } else if (currentWallpaper.url.startsWith('data:') || currentWallpaper.url.startsWith('http') || currentWallpaper.url.startsWith('blob:')) {
      root.style.setProperty('--wallpaper', `url("${currentWallpaper.url}")`);
      root.style.setProperty('--wallpaper-type', 'image');
    }
  }, [currentWallpaper]);

  return (
    <WallpaperContext.Provider
      value={{
        currentWallpaper,
        wallpapers,
        setCurrentWallpaper,
        addWallpaper,
        removeWallpaper,
        slideshowEnabled,
        setSlideshow,
      }}
    >
      {children}
    </WallpaperContext.Provider>
  );
};

export const useWallpaper = (): WallpaperContextType => {
  const context = useContext(WallpaperContext);
  if (!context) {
    throw new Error('useWallpaper must be used within a WallpaperProvider');
  }
  return context;
};