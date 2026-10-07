import { request } from './client';
import type { Entity } from './types';

export interface Project extends Entity {
  name: string;
  description: string;
  long_description: string | null;
  technologies: string[];
  github_url: string | null;
  live_url: string | null;
  featured_image: string | null;
  visibility: 'public' | 'hidden';
  featured: boolean;
  sort_order: number;
  github_repo?: string | null;
  github_stars?: number;
  github_forks?: number;
  github_language?: string | null;
  github_topics?: string[];
  github_updated_at?: string | null;
  github_sync_status?: 'not_synced' | 'synced' | 'failed';
  github_synced_at?: number | null;
}

export interface RemoteRepoInfo {
  projectId: string;
  projectName: string;
  repo: string;
  default_branch?: string;
  html_url: string;
}

export interface RemoteRepoItem {
  name: string;
  path: string;
  type: 'file' | 'dir' | 'submodule' | 'symlink';
  size: number;
  sha: string;
  html_url: string;
  download_url: string | null;
}

export interface RemoteRepoFile {
  name: string;
  path: string;
  size: number;
  sha: string;
  html_url: string;
  download_url: string | null;
  encoding: 'utf-8' | 'base64' | 'binary';
  content: string;
  isBinary: boolean;
  isOversized: boolean;
}

export type ProjectInput = Pick<Project, 'name'> & Partial<Omit<Project, keyof Entity | 'name'>>;

export const projectsApi = {
  list: () => request<Project[]>('/api/projects'),
  get: (id: string) => request<Project>(`/api/projects/${encodeURIComponent(id)}`),
  listAdmin: () => request<Project[]>('/api/admin/projects'),
  getAdmin: (id: string) => request<Project>(`/api/admin/projects/${encodeURIComponent(id)}`),
  create: (body: ProjectInput) => request<Project>('/api/admin/projects', { method: 'POST', body }),
  update: (id: string, body: Partial<ProjectInput>) => request<Project>(`/api/admin/projects/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
  syncGitHub: (id: string, github_repo?: string) =>
    request<Project>(`/api/admin/projects/${encodeURIComponent(id)}/github-sync`, {
      method: 'POST',
      body: github_repo ? { github_repo } : {},
    }),
  getRepository: (id: string) => request<RemoteRepoInfo>(`/api/projects/${encodeURIComponent(id)}/repository`),
  getRepositoryContents: (id: string, path = '', ref?: string) =>
    request<RemoteRepoItem[]>(
      `/api/projects/${encodeURIComponent(id)}/repository/contents?path=${encodeURIComponent(path)}${ref ? `&ref=${encodeURIComponent(ref)}` : ''}`
    ),
  getRepositoryFile: (id: string, path: string, ref?: string) =>
    request<RemoteRepoFile>(
      `/api/projects/${encodeURIComponent(id)}/repository/file?path=${encodeURIComponent(path)}${ref ? `&ref=${encodeURIComponent(ref)}` : ''}`
    ),
  remove: (id: string) => request<void>(`/api/admin/projects/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
