import { request } from './client';
import type { RemoteRepoItem, RemoteRepoFile } from './projects';

export interface GitHubRepoSummary {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  default_branch: string;
  language: string | null;
  topics: string[];
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  pushed_at: string;
  size: number;
  archived: boolean;
  fork: boolean;
}

export const githubApi = {
  listRepos: (refresh = false) =>
    request<GitHubRepoSummary[]>(`/api/github/repos${refresh ? '?refresh=true' : ''}`),

  getRepoContents: (repo: string, path = '', ref?: string) =>
    request<RemoteRepoItem[]>(
      `/api/github/repos/${encodeURIComponent(repo)}/contents?path=${encodeURIComponent(path)}${ref ? `&ref=${encodeURIComponent(ref)}` : ''}`
    ),

  getRepoFile: (repo: string, path: string, ref?: string) =>
    request<RemoteRepoFile>(
      `/api/github/repos/${encodeURIComponent(repo)}/file?path=${encodeURIComponent(path)}${ref ? `&ref=${encodeURIComponent(ref)}` : ''}`
    ),
};
