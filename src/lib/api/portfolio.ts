import { request } from './client';
import type { Entity } from './types';

export interface PortfolioContent extends Entity {
  key: string;
  content: string;
}

export const portfolioApi = {
  get: () => request<Record<string, string>>('/api/portfolio'),
  getContent: (key: string) => request<Pick<PortfolioContent, 'key' | 'content'>>(`/api/portfolio/${encodeURIComponent(key)}`),
  listAdmin: () => request<PortfolioContent[]>('/api/admin/portfolio'),
  save: (body: Pick<PortfolioContent, 'key' | 'content'>) => request<PortfolioContent>('/api/admin/portfolio', { method: 'PATCH', body }),
};
