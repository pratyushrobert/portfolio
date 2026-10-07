import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { loginSchema } from '../schemas/index.js';
import { validateBody } from '../middleware/validation.js';
import { getAuthenticatedUser } from '../middleware/auth.js';
import { SESSION_COOKIE_NAME, SESSION_TTL_MS } from '../services/auth.js';
import type { RouteContext } from './context.js';

export async function authRoutes(fastify: FastifyInstance, context: RouteContext): Promise<void> {
  fastify.post('/login', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    preValidation: [validateBody(loginSchema)],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { email, password } = request.body as { email: string; password: string };
      const user = context.authService.verifyCredentials(email, password);

      if (!user) {
        return reply.status(401).send({
          success: false,
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS',
        });
      }

      context.authService.deleteExpiredSessions();
      const session = context.authService.createSession(user.id);
      reply.setCookie(SESSION_COOKIE_NAME, session.id, {
        httpOnly: true,
        signed: true,
        secure: context.config.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_TTL_MS / 1000,
      });

      return reply.send({ success: true, data: { user }, message: 'Login successful' });
    },
  });

  fastify.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const rawCookie = request.cookies?.[SESSION_COOKIE_NAME];
    if (rawCookie) {
      const unsigned = request.unsignCookie(rawCookie);
      if (unsigned.valid) {
        context.authService.deleteSession(unsigned.value);
      }
    }

    reply.clearCookie(SESSION_COOKIE_NAME, { path: '/', signed: true });
    return reply.send({ success: true, message: 'Logged out successfully' });
  });

  fastify.get('/me', {
    preHandler: [async (request, reply) => {
      const rawCookie = request.cookies?.[SESSION_COOKIE_NAME];
      const unsigned = rawCookie ? request.unsignCookie(rawCookie) : { valid: false as const, value: '' };
      const user = unsigned.valid ? context.authService.getUserFromSession(unsigned.value) : null;
      if (!user) {
        await reply.status(401).send({
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHENTICATED',
        });
        return;
      }
      (request as unknown as { user: typeof user }).user = user;
    }],
    handler: async (request) => ({
      success: true,
      data: { user: getAuthenticatedUser(request) },
    }),
  });
}
