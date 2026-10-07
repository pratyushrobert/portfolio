import { request } from './client';
import type { Timestamps } from './types';

export interface SiteConfigEntry extends Timestamps {
  key: string;
  value: string;
  description: string | null;
}

export type SiteConfigInput = Pick<SiteConfigEntry, 'key' | 'value'> & Partial<Pick<SiteConfigEntry, 'description'>>;

export const configApi = {
  get: () => request<Record<string, string>>('/api/config'),
  getEntry: (key: string) => request<Pick<SiteConfigEntry, 'key' | 'value'>>(`/api/config/${encodeURIComponent(key)}`),
  listAdmin: () => request<SiteConfigEntry[]>('/api/admin/config'),
  save: (body: SiteConfigInput) => request<SiteConfigEntry>('/api/admin/config', { method: 'PATCH', body }),
  saveMany: (body: SiteConfigInput[]) => request<SiteConfigEntry[]>('/api/admin/config', { method: 'PATCH', body }),
};
