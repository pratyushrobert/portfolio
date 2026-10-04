import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { getSessionFromCookie, getUserFromSession } from '../services/auth.js';
import type { AuthUser, AuthenticatedRequest } from '../types/index.js';

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<AuthenticatedRequest> {
  const sessionId = request.cookies?.mimios_session ||
    request.headers.cookie?.split(';').map(c => c.trim()).find(c => c.startsWith('mimios_session='))?.split('=')[1];

  if (!sessionId) {
    return reply.status(401).send({
      success: false,
      error: 'Authentication required',
      code: 'UNAUTHENTICATED'
    });
  }

  const user = await getUserFromSession(sessionId);
  if (!user) {
    reply.clearCookie('mimios_session', { path: '/' });
    return reply.status(401).send({
      success: false,
      error: 'Invalid or expired session',
      code: 'INVALID_SESSION'
    });
  }

  (request as AuthenticatedRequest).user = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role
  };

  return request as AuthenticatedRequest;
}

export async function optionalAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const sessionId = request.cookies?.mimios_session ||
    request.headers.cookie?.split(';').map(c => c.trim()).find(c => c.startsWith('mimios_session='))?.split('=')[1];

  if (sessionId) {
    const user = await getUserFromSession(sessionId);
    if (user) {
      (request as any).user = user;
    }
  }
}

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = (request as any).user;
    if (!user || !roles.includes(user.role)) {
      return reply.status(403).send({
        success: false,
        error: 'Insufficient permissions',
        code: 'FORBIDDEN'
      });
    }
  };
}