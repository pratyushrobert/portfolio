import { request } from './client';
import type { Entity } from './types';

export interface Skill extends Entity {
  name: string;
  category: 'programming' | 'cybersecurity' | 'web' | 'tools' | 'infrastructure' | 'databases' | 'other';
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert' | null;
  sort_order: number;
  visibility: boolean;
}

export type SkillInput = Pick<Skill, 'name' | 'category'> & Partial<Pick<Skill, 'level' | 'sort_order' | 'visibility'>>;

export const skillsApi = {
  list: () => request<Skill[]>('/api/skills'),
  listAdmin: () => request<Skill[]>('/api/admin/skills'),
  create: (body: SkillInput) => request<Skill>('/api/admin/skills', { method: 'POST', body }),
  update: (id: string, body: Partial<SkillInput>) => request<Skill>(`/api/admin/skills/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
  remove: (id: string) => request<void>(`/api/admin/skills/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
