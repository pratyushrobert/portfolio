/**
 * MimiOS Admin VFS Utilities
 * Provides reactive access to built-in assets and VFS content
 */

import { useState, useEffect, useCallback } from 'react';
import { vfs } from '../../lib/vfs';
import { isFileNode } from '../../lib/vfs/nodes';

/**
 * Hook to access VFS built-in assets for admin display
 */
export function useBuiltInAssets() {
  const [assets, setAssets] = useState<Array<{
    id: string;
    name: string;
    path: string;
    assetPath: string;
    mimeType: string;
    size: number;
    category: 'image' | 'video' | 'document';
  }>>([]);

  const refresh = useCallback(() => {
    const state = vfs.getState();
    const found: typeof assets = [];

    Object.values(state.nodes).forEach(node => {
      if (isFileNode(node) && node.assetPath && !node.storageKey) {
        const ext = node.name.split('.').pop()?.toLowerCase() || '';
        let category: 'image' | 'video' | 'document' = 'document';
        if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) category = 'image';
        else if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) category = 'video';

        found.push({
          id: node.id,
          name: node.name,
          path: vfs.getNodePath(node.id),
          assetPath: node.assetPath,
          mimeType: node.mimeType,
          size: node.size,
          category,
        });
      }
    });

    setAssets(found);
  }, []);

  useEffect(() => {
    refresh();
    const unsubscribe = vfs.subscribe(refresh);
    return unsubscribe;
  }, [refresh]);

  return { assets, refresh };
}

/**
 * Hook to get VFS text file content for editing
 */
export function useVfsFileContent(path: string) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = vfs.readFile(path);
    if (result.success) {
      setContent(result.data || '');
    } else {
      setError(result.error || 'Failed to read file');
      setContent('');
    }
    setLoading(false);
  }, [path]);

  const save = useCallback(async (newContent: string) => {
    setLoading(true);
    setError(null);
    const statResult = vfs.stat(path);
    if (!statResult.success || !statResult.data) {
      setError('File not found');
      setLoading(false);
      return false;
    }

    const mimeType = statResult.data.mimeType || 'text/plain';
    const result = vfs.writeFile(path, newContent, mimeType);
    if (result.success) {
      setContent(newContent);
      setLoading(false);
      return true;
    } else {
      setError(result.error || 'Failed to save file');
      setLoading(false);
      return false;
    }
  }, [path]);

  return { content, loading, error, load, save, setContent };
}