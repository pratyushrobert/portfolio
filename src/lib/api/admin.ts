import { request } from './client';

export interface AdminDashboardData {
  projects: number;
  projects_public?: number;
  projects_featured?: number;
  skills: number;
  skills_public?: number;
  experience: number;
  experience_public?: number;
  certificates: number;
  certificates_public?: number;
  assets: number;
  active_sessions: number;
  github_linked_projects?: number;
  github_synced_projects?: number;
  github_username?: string;
}

export const adminApi = {
  dashboard: () => request<AdminDashboardData>('/api/admin/dashboard'),
};
