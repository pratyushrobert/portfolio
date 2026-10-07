import { request } from './client';
import type { Entity } from './types';

export interface Experience extends Entity {
  organization: string;
  role: string;
  start_date: string;
  end_date: string | null;
  description: string | null;
  technologies: string[];
  link: string | null;
  sort_order: number;
  visibility: boolean;
}

export type ExperienceInput = Pick<Experience, 'organization' | 'role' | 'start_date'> &
  Partial<Pick<Experience, 'end_date' | 'technologies' | 'link' | 'sort_order' | 'visibility'>> & { description?: string };

export const experienceApi = {
  list: () => request<Experience[]>('/api/experience'),
  listAdmin: () => request<Experience[]>('/api/admin/experience'),
  create: (body: ExperienceInput) => request<Experience>('/api/admin/experience', { method: 'POST', body }),
  update: (id: string, body: Partial<ExperienceInput>) => request<Experience>(`/api/admin/experience/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
  remove: (id: string) => request<void>(`/api/admin/experience/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
