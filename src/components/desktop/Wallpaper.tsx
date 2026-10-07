import { useEffect } from 'react';
import { useDesktopStore } from '../../stores/useDesktopStore';
import { configApi } from '../../lib/api/config';
import './Desktop.css';

function parseOverlayColor(overlay: string): string {
  if (!overlay || overlay === 'none') return '#000000';
  if (overlay.startsWith('#')) return overlay;
  const match = overlay.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    return `rgb(${match[1]}, ${match[2]}, ${match[3]})`;
  }
  return '#000000';
}

export function Wallpaper() {
  const wallpaper = useDesktopStore(state => state.wallpaper);
  const wallpaperPosition = useDesktopStore(state => state.wallpaperPosition) || 'center';
  const wallpaperSize = useDesktopStore(state => state.wallpaperSize) || 'cover';
  const wallpaperOverlay = useDesktopStore(state => state.wallpaperOverlay) || '#000000';
  const wallpaperColor = useDesktopStore(state => state.wallpaperColor) || '#08090d';
  const wallpaperBrightness = useDesktopStore(state => state.wallpaperBrightness ?? 100);
  const wallpaperOverlayOpacity = useDesktopStore(state => state.wallpaperOverlayOpacity ?? 30);
  const setBackgroundConfig = useDesktopStore(state => state.setBackgroundConfig);

  // Authoritative site configuration load on startup
  useEffect(() => {
    let active = true;
    async function loadSiteConfig() {
      try {
        const config = await configApi.get();
        if (!active || !config) return;
        const rawBrightness = config.wallpaper_brightness ? parseInt(config.wallpaper_brightness, 10) : 100;
        const rawOverlayOpacity = config.wallpaper_overlay_opacity ? parseInt(config.wallpaper_overlay_opacity, 10) : 30;
        const activeBrightness = isNaN(rawBrightness) ? 100 : Math.min(100, Math.max(0, rawBrightness));
        const activeOverlayOpacity = isNaN(rawOverlayOpacity) ? 30 : Math.min(100, Math.max(0, rawOverlayOpacity));

        setBackgroundConfig({
          wallpaper: config.wallpaper_url ?? '',
          wallpaperPosition: config.wallpaper_position ?? 'center',
          wallpaperSize: config.wallpaper_size ?? 'cover',
          wallpaperOverlay: config.wallpaper_overlay ?? '#000000',
          wallpaperColor: config.wallpaper_color && config.wallpaper_color !== '#1a1a2e' ? config.wallpaper_color : '#08090d',
          wallpaperBrightness: activeBrightness,
          wallpaperOverlayOpacity: activeOverlayOpacity,
        });
      } catch (err) {
        // Sensible fallback if backend unavailable
        console.warn('Backend site configuration unavailable; using fallback defaults.', err);
      }
    }
    void loadSiteConfig();
    return () => { active = false; };
  }, [setBackgroundConfig]);

  const hasImage = Boolean(wallpaper && wallpaper.trim());

  return (
    <div
      className="desktop-wallpaper"
      style={{
        backgroundColor: wallpaperColor,
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        filter: !hasImage ? `brightness(${wallpaperBrightness}%)` : undefined,
        transition: 'filter 0.2s ease',
      }}
      aria-hidden="true"
    >
      {hasImage && (
        <div
          className="desktop-wallpaper-image"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url("${wallpaper}")`,
            backgroundSize: wallpaperSize,
            backgroundPosition: wallpaperPosition,
            backgroundRepeat: 'no-repeat',
            filter: `brightness(${wallpaperBrightness}%)`,
            transition: 'filter 0.2s ease',
          }}
        />
      )}
      <div
        className="desktop-wallpaper-overlay"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: parseOverlayColor(wallpaperOverlay),
          opacity: wallpaperOverlayOpacity / 100,
          pointerEvents: 'none',
          transition: 'opacity 0.2s ease',
        }}
      />
    </div>
  );
}