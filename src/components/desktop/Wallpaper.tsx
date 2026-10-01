import { useDesktopStore } from '../../stores/useDesktopStore';
import './Desktop.css';

export function Wallpaper() {
  const wallpaper = useDesktopStore(state => state.wallpaper);

  return (
    <div
      className="desktop-wallpaper"
      style={{
        backgroundImage: wallpaper ? `url(${wallpaper})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
      aria-hidden="true"
    />
  );
}