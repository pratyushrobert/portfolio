import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { verifyCredentials, createAuthCookie, clearAuthCookie, getSessionFromCookie, getUserFromSession } from '../services/auth.js';
import { optionalAuth } from '../middleware/auth.js';

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 1 }
        }
      }
    },
    preHandler: [optionalAuth],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { email, password } = request.body as { email: string; password: string };

      const user = await verifyCredentials(email, password);
      if (!user) {
        return reply.status(401).send({
          success: false,
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        });
      }

      const sessionId = createSession(user.id);
      reply.setCookie('mimios_session', sessionId, {
        httpOnly: true,
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });

      return reply.send({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
          }
        },
        message: 'Login successful'
      });
    }
  });

  fastify.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionId = request.cookies?.mimios_session;
    if (sessionId) {
      deleteSession(sessionId);
    }

    reply.clearCookie('mimios_session', { path: '/' });
    return reply.send({
      success: true,
      message: 'Logged out successfully'
    });
  });

  fastify.get('/me', {
    preHandler: [async (request, reply) => {
      const sessionId = request.cookies?.mimios_session ||
        request.headers.cookie?.split(';').map(c => c.trim()).find(c => c.startsWith('mimios_session='))?.split('=')[1];

      if (!sessionId) {
        return fastify.httpErrors.unauthorized('Authentication required');
      }

      const user = await getUserFromSession(sessionId);
      if (!user) {
        return fastify.httpErrors.unauthorized('Invalid or expired session');
      }

      (request as any).user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      };
    }],
    handler: async (request, reply) => {
      const user = (request as any).user;
      return reply.send({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
          }
        }
      });
    }
  });
}