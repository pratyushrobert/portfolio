import { request } from './client';
import type { Entity } from './types';

export interface PortfolioAsset extends Entity {
  name: string;
  category: 'image' | 'video' | 'document';
  asset_path: string;
  mime_type: string;
  size: number;
  featured: boolean;
  visibility: boolean;
  tags: string[];
  sort_order: number;
  url: string;
}

export interface AssetListQuery {
  category?: PortfolioAsset['category'];
  limit?: number;
  offset?: number;
}

export type AssetUploadMetadata = Pick<PortfolioAsset, 'category'> &
  Partial<Pick<PortfolioAsset, 'name' | 'featured' | 'visibility' | 'tags' | 'sort_order'>>;

/** Permanent portfolio assets only; visitor files remain browser-local. */
export const assetsApi = {
  list(query: AssetListQuery = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) params.set(key, String(value));
    }
    const search = params.toString();
    return request<PortfolioAsset[]>(`/api/assets${search ? `?${search}` : ''}`);
  },
  listAdmin: () => request<PortfolioAsset[]>('/api/admin/assets'),
  upload(file: File, metadata: AssetUploadMetadata) {
    const body = new FormData();
    for (const [key, value] of Object.entries(metadata)) {
      if (value !== undefined) body.append(key, key === 'tags' ? JSON.stringify(value) : String(value));
    }
    body.append('file', file);
    return request<PortfolioAsset>('/api/admin/assets', { method: 'POST', body });
  },
  remove: (id: string) => request<void>(`/api/admin/assets/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
