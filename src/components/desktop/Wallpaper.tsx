import { useDesktopStore } from '../../stores/useDesktopStore';
import { loadAdminConfig } from '../../lib/admin/configStorage';
import { useState, useEffect } from 'react';
import './Desktop.css';

export function Wallpaper() {
  const wallpaper = useDesktopStore(state => state.wallpaper);
  const [adminWallpaper, setAdminWallpaper] = useState<string>('');

  // Load admin wallpaper on mount
  useEffect(() => {
    const adminConfig = loadAdminConfig();
    if (adminConfig.appearance.background.image) {
      setAdminWallpaper(adminConfig.appearance.background.image);
    }
  }, []);

  // Use admin wallpaper if set, otherwise fall back to desktop store
  const effectiveWallpaper = adminWallpaper || wallpaper;

  return (
    <div
      className="desktop-wallpaper"
      style={{
        backgroundImage: effectiveWallpaper ? `url(${effectiveWallpaper})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
      aria-hidden="true"
    />
  );
}