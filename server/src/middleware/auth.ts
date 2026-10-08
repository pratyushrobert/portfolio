import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthService, SessionCookieConfig } from '../services/auth.js';
import { SESSION_COOKIE_NAME, getSessionCookieOptions } from '../services/auth.js';
import type { AuthenticatedRequest } from '../types/index.js';

function sessionIdFromRequest(request: FastifyRequest): string | null {
  const rawCookie = request.cookies?.[SESSION_COOKIE_NAME];
  if (!rawCookie) {
    return null;
  }

  const unsigned = request.unsignCookie(rawCookie);
  return unsigned.valid ? unsigned.value : null;
}

export function authenticate(authService: AuthService, cookieConfig?: SessionCookieConfig) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const rawCookie = request.cookies?.[SESSION_COOKIE_NAME];
    const sessionId = sessionIdFromRequest(request);
    const user = sessionId ? await authService.getUserFromSession(sessionId) : null;

    if (!user) {
      if (rawCookie) {
        const options = cookieConfig ? getSessionCookieOptions(cookieConfig) : { path: '/', signed: true };
        reply.clearCookie(SESSION_COOKIE_NAME, options);
      }
      await reply.status(401).send({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHENTICATED',
      });
      return;
    }

    (request as AuthenticatedRequest).user = user;
  };
}

export function getAuthenticatedUser(request: FastifyRequest): AuthenticatedRequest['user'] {
  return (request as AuthenticatedRequest).user;
}
