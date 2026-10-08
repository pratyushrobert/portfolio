import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { RuntimeConfig } from '../config/env.js';

export interface StorageService {
  upload(filename: string, buffer: Buffer, mimeType: string): Promise<string>;
  delete(filename: string): Promise<void>;
  getPublicUrl(filename: string): string;
  readonly isExternalStorage: boolean;
}

export function createStorageService(config: RuntimeConfig): StorageService {
  const hasSupabase = Boolean(config.SUPABASE_URL && config.SUPABASE_SECRET_KEY);
  const bucketName = config.SUPABASE_STORAGE_BUCKET || 'mimios-assets';

  if (hasSupabase) {
    const supabase: SupabaseClient = createClient(
      config.SUPABASE_URL as string,
      config.SUPABASE_SECRET_KEY as string,
      { auth: { persistSession: false } }
    );

    return {
      isExternalStorage: true,

      async upload(filename: string, buffer: Buffer, mimeType: string): Promise<string> {
        const { error } = await supabase.storage
          .from(bucketName)
          .upload(filename, buffer, {
            contentType: mimeType,
            upsert: true,
          });

        if (error) {
          throw new Error(`Supabase Storage upload failed: ${error.message}`);
        }

        return this.getPublicUrl(filename);
      },

      async delete(filename: string): Promise<void> {
        const { error } = await supabase.storage
          .from(bucketName)
          .remove([filename]);

        if (error) {
          throw new Error(`Supabase Storage delete failed: ${error.message}`);
        }
      },

      getPublicUrl(filename: string): string {
        const cleanName = encodeURIComponent(filename);
        return `${config.SUPABASE_URL}/storage/v1/object/public/${bucketName}/${cleanName}`;
      },
    };
  }

  // Local fallback for offline development / test environments
  return {
    isExternalStorage: false,

    async upload(filename: string, buffer: Buffer): Promise<string> {
      const uploadDir = resolve(config.UPLOAD_DIR);
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true });
      }
      const targetPath = join(uploadDir, filename);
      await writeFile(targetPath, buffer);
      return `/uploads/${encodeURIComponent(filename)}`;
    },

    async delete(filename: string): Promise<void> {
      if (filename !== basename(filename) || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        throw new Error('Invalid filename for deletion');
      }
      const root = resolve(config.UPLOAD_DIR);
      const target = resolve(root, filename);
      const relativeTarget = relative(root, target);
      if (relativeTarget === '' || relativeTarget === '..' || relativeTarget.startsWith(`..${sep}`) || isAbsolute(relativeTarget)) {
        throw new Error('Invalid path traversal attempt');
      }
      await rm(target, { force: true });
    },

    getPublicUrl(filename: string): string {
      return `/uploads/${encodeURIComponent(filename)}`;
    },
  };
}
