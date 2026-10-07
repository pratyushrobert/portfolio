import type { FastifyRequest } from 'fastify';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin';
}

export interface AuthenticatedRequest extends FastifyRequest {
  user: AuthUser;
}

export interface Session {
  id: string;
  user_id: string;
  expires_at: number;
  created_at: number;
}

export interface ApiResponse<T = unknown> {
  success: true;
  data?: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: Array<{ field: string; message: string; code: string }>;
}
