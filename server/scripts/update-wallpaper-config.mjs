import Database from 'better-sqlite3';
import { resolve } from 'node:path';

const dbPath = resolve(process.cwd(), 'data/mimios.db');
console.log('Opening database at:', dbPath);
const db = new Database(dbPath);

const now = Date.now();
const updateConfig = db.prepare(`
  INSERT INTO site_config (key, value, description, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`);

// 1. Remove purple overlay tint and replace with neutral graphite/black overlay
updateConfig.run('wallpaper_overlay', 'rgba(0, 0, 0, 0.3)', 'Wallpaper overlay', now, now);
// 2. Remove purple fallback color and replace with neutral obsidian
updateConfig.run('wallpaper_color', '#08090d', 'Wallpaper fallback color', now, now);
// 3. Ensure brightness and overlay opacity keys exist
updateConfig.run('wallpaper_brightness', '100', 'Wallpaper brightness percentage', now, now);
updateConfig.run('wallpaper_overlay_opacity', '30', 'Wallpaper overlay darkness percentage', now, now);

console.log('Database updated successfully:');
const rows = db.prepare("SELECT key, value FROM site_config WHERE key LIKE 'wallpaper%'").all();
console.log(rows);
db.close();
