import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyMultipart from '@fastify/multipart';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { RuntimeConfig } from './config/env.js';
import type { AppDatabase } from './db/index.js';
import { createAuthService } from './services/auth.js';
import { adminRoutes } from './routes/admin.js';
import { assetAdminRoutes, assetRoutes } from './routes/assets.js';
import { authRoutes } from './routes/auth.js';
import { certificateAdminRoutes, certificateRoutes } from './routes/certificates.js';
import { configAdminRoutes, configRoutes } from './routes/config.js';
import { experienceAdminRoutes, experienceRoutes } from './routes/experience.js';
import { portfolioAdminRoutes, portfolioRoutes } from './routes/portfolio.js';
import { projectAdminRoutes, projectRoutes } from './routes/projects.js';
import { githubRoutes } from './routes/github.js';
import { skillAdminRoutes, skillRoutes } from './routes/skills.js';

export interface AppOptions {
  database: AppDatabase;
  config: RuntimeConfig;
}

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const { database, config } = options;
  await mkdir(resolve(config.UPLOAD_DIR), { recursive: true });
  const authService = createAuthService(database);
  authService.deleteExpiredSessions();
  const context = { database, authService, config };
  const fastify = Fastify({
    logger: config.NODE_ENV === 'test' ? false : { level: config.NODE_ENV === 'production' ? 'info' : 'debug' },
    bodyLimit: config.UPLOAD_MAX_SIZE + 1024 * 1024,
  });

  const allowedOrigins = new Set(config.CORS_ORIGIN.split(',').map((origin) => origin.trim()));

  fastify.addHook('onRequest', async (request, reply) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      const origin = request.headers.origin;
      if (origin && !allowedOrigins.has(origin)) {
        return reply.status(403).send({
          success: false,
          error: 'Cross-origin request forbidden',
          code: 'ORIGIN_FORBIDDEN',
        });
      }
    }
  });

  await fastify.register(fastifyHelmet);
  await fastify.register(fastifyCors, {
    origin: Array.from(allowedOrigins),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  await fastify.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });
  await fastify.register(fastifyCookie, { secret: config.SESSION_SECRET });
  await fastify.register(fastifyMultipart, {
    limits: { fileSize: config.UPLOAD_MAX_SIZE, files: 1, fields: 20 },
  });
  await fastify.register(fastifyStatic, {
    root: resolve(config.UPLOAD_DIR),
    prefix: '/uploads/',
    decorateReply: false,
  });

  fastify.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }));

  await fastify.register(authRoutes, { prefix: '/api/auth', ...context });
  await fastify.register(portfolioRoutes, { prefix: '/api/portfolio', ...context });
  await fastify.register(projectRoutes, { prefix: '/api/projects', ...context });
  await fastify.register(githubRoutes, { prefix: '/api/github', ...context });
  await fastify.register(skillRoutes, { prefix: '/api/skills', ...context });
  await fastify.register(experienceRoutes, { prefix: '/api/experience', ...context });
  await fastify.register(certificateRoutes, { prefix: '/api/certificates', ...context });
  await fastify.register(assetRoutes, { prefix: '/api/assets', ...context });
  await fastify.register(configRoutes, { prefix: '/api/config', ...context });

  await fastify.register(adminRoutes, { prefix: '/api/admin', ...context });
  await fastify.register(portfolioAdminRoutes, { prefix: '/api/admin/portfolio', ...context });
  await fastify.register(projectAdminRoutes, { prefix: '/api/admin/projects', ...context });
  await fastify.register(skillAdminRoutes, { prefix: '/api/admin/skills', ...context });
  await fastify.register(experienceAdminRoutes, { prefix: '/api/admin/experience', ...context });
  await fastify.register(certificateAdminRoutes, { prefix: '/api/admin/certificates', ...context });
  await fastify.register(assetAdminRoutes, { prefix: '/api/admin/assets', ...context });
  await fastify.register(configAdminRoutes, { prefix: '/api/admin/config', ...context });

  fastify.setNotFoundHandler(async (_request, reply) => {
    return reply.status(404).send({ success: false, error: 'Not found', code: 'NOT_FOUND' });
  });

  fastify.setErrorHandler(async (error, _request, reply) => {
    const requestError = error as { statusCode?: unknown; message?: unknown; code?: unknown };
    const statusCode = typeof requestError.statusCode === 'number' ? requestError.statusCode : 500;
    const message = statusCode < 500 || config.NODE_ENV !== 'production'
      ? typeof requestError.message === 'string' ? requestError.message : 'Request failed'
      : 'Internal server error';
    fastify.log.error({ err: error }, 'Request failed');
    return reply.status(statusCode).send({
      success: false,
      error: message,
      code: statusCode >= 500 ? 'INTERNAL_ERROR' : typeof requestError.code === 'string' ? requestError.code : 'REQUEST_ERROR',
    });
  });

  return fastify;
}
