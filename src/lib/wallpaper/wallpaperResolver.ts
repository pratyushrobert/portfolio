import { useState, useEffect, useRef } from 'react';
import { vfs } from '../vfs';

export const SUPPORTED_WALLPAPER_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'] as const;

export const MAX_WALLPAPER_BYTES = 20 * 1024 * 1024; // 20 MB safe threshold for browser desktop wallpapers

/**
 * Checks if a filename or extension is an eligible image format
 */
export function isSupportedImageExtension(filenameOrExt: string): boolean {
  if (!filenameOrExt) return false;
  const parts = filenameOrExt.split('.');
  const ext = (parts.length > 1 ? parts.pop() : filenameOrExt)?.toLowerCase().trim() || '';
  return SUPPORTED_WALLPAPER_EXTENSIONS.includes(ext as (typeof SUPPORTED_WALLPAPER_EXTENSIONS)[number]);
}

/**
 * Cleanly format a wallpaper reference for human display
 */
export function getWallpaperDisplayName(ref: string): string {
  if (!ref || !ref.trim()) return '';
  const clean = ref.trim().replace(/^vfs:/, '');
  const basename = clean.split('/').pop() || clean;
  return basename;
}

/**
 * Asynchronously resolves a wallpaper reference (VFS path, asset reference, or URL)
 * into a browser-displayable URL (static path, blob URL, or data URL).
 * Fails gracefully and returns '' if the target is invalid, oversized, or missing.
 */
export async function resolveWallpaperSource(ref: string): Promise<string> {
  if (!ref || !ref.trim()) return '';
  const cleanRef = ref.trim();

  // 1. Direct web URLs, relative public assets, or embedded data URIs
  if (
    cleanRef.startsWith('http://') ||
    cleanRef.startsWith('https://') ||
    cleanRef.startsWith('data:') ||
    cleanRef.startsWith('/portfolio/') ||
    cleanRef.startsWith('/assets/') ||
    cleanRef.startsWith('/uploads/')
  ) {
    return cleanRef;
  }

  // 2. VirtualFS Path (e.g. "vfs:/home/pratyush/images/hero.png" or "/home/pratyush/images/hero.png")
  const vfsPath = cleanRef.startsWith('vfs:') ? cleanRef.slice(4) : cleanRef;

  try {
    const statResult = vfs.stat(vfsPath);
    if (!statResult.success || !statResult.data) {
      return '';
    }

    const node = statResult.data;
    if (node.type === 'directory') {
      return '';
    }

    // Validate image format
    if (!isSupportedImageExtension(node.name)) {
      console.warn(`[WallpaperResolver] Rejected non-image file: ${node.name}`);
      return '';
    }

    // Validate file size limit
    if (typeof node.size === 'number' && node.size > MAX_WALLPAPER_BYTES) {
      console.warn(`[WallpaperResolver] Rejected oversized wallpaper (${node.size} bytes): ${node.name}`);
      return '';
    }

    // 2a. Built-in static asset reference
    if (node.assetPath) {
      return node.assetPath;
    }

    // 2b. Binary file stored in IndexedDB (visitor upload)
    if (node.isBinary && node.storageKey) {
      const binaryResult = await vfs.readBinaryFile(vfsPath);
      if (binaryResult.success && binaryResult.data) {
        return URL.createObjectURL(binaryResult.data);
      }
      return '';
    }

    // 2c. Text or base64 data in VFS node content
    const fileResult = vfs.readFile(vfsPath);
    if (fileResult.success && fileResult.data) {
      const content = fileResult.data;
      if (content.startsWith('data:image/')) {
        return content;
      }
      const mime = node.mimeType || 'image/png';
      return `data:${mime};base64,${content}`;
    }
  } catch (err) {
    console.warn(`[WallpaperResolver] Failed to resolve wallpaper for "${cleanRef}":`, err);
  }

  return '';
}

/**
 * React hook that manages wallpaper source resolution with automatic cleanup of object URLs
 */
export function useWallpaperSource(wallpaperRef: string): {
  url: string;
  loading: boolean;
  error: string | null;
} {
  const [url, setUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const activeBlobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Helper to release previous blob URL from memory
    const revokePrevious = () => {
      if (activeBlobUrlRef.current && activeBlobUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }
    };

    if (!wallpaperRef || !wallpaperRef.trim()) {
      revokePrevious();
      setUrl('');
      setLoading(false);
      setError(null);
      return;
    }

    // If it's a direct web asset or data URL, resolve synchronously
    const cleanRef = wallpaperRef.trim();
    if (
      cleanRef.startsWith('http://') ||
      cleanRef.startsWith('https://') ||
      cleanRef.startsWith('data:') ||
      cleanRef.startsWith('/portfolio/')
    ) {
      revokePrevious();
      setUrl(cleanRef);
      setLoading(false);
      setError(null);
      return;
    }

    // Otherwise resolve via VFS asynchronously
    setLoading(true);
    setError(null);

    void resolveWallpaperSource(cleanRef)
      .then((resolved) => {
        if (cancelled) {
          if (resolved.startsWith('blob:')) {
            URL.revokeObjectURL(resolved);
          }
          return;
        }

        revokePrevious();
        if (resolved.startsWith('blob:')) {
          activeBlobUrlRef.current = resolved;
        }

        setUrl(resolved);
        if (!resolved) {
          setError('Wallpaper image could not be loaded or is missing');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        revokePrevious();
        setUrl('');
        setError(err instanceof Error ? err.message : 'Failed to load wallpaper');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      revokePrevious();
    };
  }, [wallpaperRef]);

  return { url, loading, error };
}
