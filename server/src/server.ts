import Fastify from 'fastify';
import fastifyCors from 'fastify-cors';
import fastifyHelmet from 'fastify-helmet';
import fastifyRateLimit from 'fastify-rate-limit';
import fastifyStatic from 'fastify-static';
import fastifyCookie from 'fastify-cookie';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { db, initializeDatabase, closeDb } from './db/index.js';
import { env } from './config/env.js';
import { authRoutes } from './routes/auth.js';
import { portfolioRoutes } from './routes/portfolio.js';
import { projectRoutes } from './routes/projects.js';
import { skillRoutes } from './routes/skills.js';
import { experienceRoutes } from './routes/experience.js';
import { certificateRoutes } from './routes/certificates.js';
import { assetRoutes } from './routes/assets.js';
import { configRoutes } from './routes/config.js';
import { adminRoutes } from './routes/admin.js';
import { optionalAuth, authenticate } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fastify = Fastify({
  logger: {
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: env.NODE_ENV !== 'production' ? {
      target: 'pino-pretty',
      options: { colorize: true }
    } : undefined
  });

// Register plugins
await fastify.register(fastifyHelmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
    }
  }
});

await fastify.register(fastifyCors, {
  origin: env.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
});

await fastify.register(fastifyRateLimit, {
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (req) => req.ip
});

await fastify.register(fastifyCookie, {
  secret: env.SESSION_SECRET,
  parseOptions: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' }
});

await fastify.register(fastifyStatic, {
  root: join(__dirname, '../public'),
  prefix: '/assets/'
});

await fastify.register(fastifyStatic, {
  root: join(__dirname, '../uploads'),
  prefix: '/uploads/'
});

// Health check
fastify.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }));

// Register routes
await fastify.register(authRoutes, { prefix: '/api/auth' });
await fastify.register(portfolioRoutes, { prefix: '/api/portfolio' });
await fastify.register(projectRoutes, { prefix: '/api/projects' });
await fastify.register(skillRoutes, { prefix: '/api/skills' });
await fastify.register(experienceRoutes, { prefix: '/api/experience' });
await fastify.register(certificateRoutes, { prefix: '/api/certificates' });
await fastify.register(assetRoutes, { prefix: '/api/assets' });
await fastify.register(configRoutes, { prefix: '/api/config' });
await fastify.register(adminRoutes, { prefix: '/api/admin' });

// Global error handler
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);

  if (reply.sent) return;

  if (reply.statusCode >= 400 && reply.statusCode < 500) {
    return reply.status(reply.statusCode).send({
      success: false,
      error: error.message,
      code: error.code || 'CLIENT_ERROR'
    });
  }

  return reply.status(500).send({
    success: false,
    error: env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
    code: 'INTERNAL_ERROR'
  });
});

// 404 handler
fastify.setNotFoundHandler((request, reply) => {
  return reply.status(404).send({
    success: false,
    error: 'Not found',
    code: 'NOT_FOUND'
  });
});

// Initialize database
initializeDatabase();

// Graceful shutdown
process.on('SIGTERM', async () => {
  fastify.log.info('Shutting down...');
  await closeDb();
  await fastify.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  fastify.log.info('Shutting down...');
  await closeDb();
  await fastify.close();
  process.exit(0);
});

// Start server
try {
  await fastify.listen({ port: env.PORT, host: '0.0.0.0' });
  fastify.log.info(`Server running on http://localhost:${env.PORT}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}