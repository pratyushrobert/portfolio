import { FastifyRequest, FastifyReply } from 'fastify';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: number;
  updated_at: number;
}

export interface PortfolioContent {
  id: string;
  key: string;
  content: string;
  created_at: number;
  updated_at: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  long_description: string | null;
  technologies: string;
  github_url: string | null;
  live_url: string | null;
  featured_image: string | null;
  visibility: 'public' | 'hidden';
  featured: number;
  sort_order: number;
  created_at: number;
  updated_at: number;
}

export interface Skill {
  id: string;
  name: string;
  category: string;
  level: string | null;
  sort_order: number;
  visibility: number;
  created_at: number;
  updated_at: number;
}

export interface Experience {
  id: string;
  organization: string;
  role: string;
  start_date: string;
  end_date: string | null;
  description: string;
  technologies: string;
  link: string | null;
  sort_order: number;
  visibility: number;
  created_at: number;
  updated_at: number;
}

export interface Certificate {
  id: string;
  name: string;
  issuer: string;
  date: string;
  description: string | null;
  asset_id: string | null;
  link: string | null;
  sort_order: number;
  visibility: number;
  created_at: number;
  updated_at: number;
}

export interface Asset {
  id: string;
  name: string;
  category: 'image' | 'video' | 'document';
  asset_path: string;
  mime_type: string;
  size: number | null;
  featured: number;
  visibility: number;
  tags: string | null;
  sort_order: number;
  created_at: number;
  updated_at: number;
}

export interface SiteConfig {
  key: string;
  value: string;
  description: string | null;
  created_at: number;
  updated_at: number;
}

export interface Session {
  id: string;
  user_id: string;
  expires_at: number;
  created_at: number;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface AuthenticatedRequest extends FastifyRequest {
  user?: AuthUser;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  details?: ValidationError[];
}