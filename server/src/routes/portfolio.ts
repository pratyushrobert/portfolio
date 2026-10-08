import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { authenticate } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import { keyParamSchema, portfolioPatchSchema } from '../schemas/index.js';
import type { RouteContext } from './context.js';

export async function portfolioRoutes(fastify: FastifyInstance, context: RouteContext): Promise<void> {
  fastify.get('/', async () => {
    const rows = await context.database.queryAll<{ key: string; content: string }>(
      'SELECT key, content FROM portfolio_content ORDER BY key'
    );
    return { success: true, data: Object.fromEntries(rows.map((row) => [row.key, row.content])) };
  });

  fastify.get('/:key', {
    preValidation: [validateParams(keyParamSchema)],
    handler: async (request, reply) => {
      const { key } = request.params as { key: string };
      const content = await context.database.queryOne<{ key: string; content: string }>(
        'SELECT key, content FROM portfolio_content WHERE key = $1',
        [key]
      );
      if (!content) {
        return reply.status(404).send({ success: false, error: 'Portfolio content not found', code: 'NOT_FOUND' });
      }
      return { success: true, data: content };
    },
  });
}

export async function portfolioAdminRoutes(fastify: FastifyInstance, context: RouteContext): Promise<void> {
  const admin = authenticate(context.authService, context.config);

  fastify.get('/', { preHandler: [admin] }, async () => {
    const rows = await context.database.queryAll('SELECT * FROM portfolio_content ORDER BY key');
    return { success: true, data: rows };
  });

  fastify.patch('/', {
    preHandler: [admin],
    preValidation: [validateBody(portfolioPatchSchema)],
    handler: async (request, reply) => {
      const { key, content } = request.body as { key: string; content: string };
      const now = Date.now();
      await context.database.execute(`
        INSERT INTO portfolio_content (id, key, content, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT(key) DO UPDATE SET content = EXCLUDED.content, updated_at = EXCLUDED.updated_at
      `, [randomUUID(), key, content, now, now]);
      const saved = await context.database.queryOne('SELECT * FROM portfolio_content WHERE key = $1', [key]);
      return reply.send({ success: true, data: saved });
    },
  });

  fastify.patch('/:key', {
    preHandler: [admin],
    preValidation: [validateParams(keyParamSchema), validateBody(portfolioPatchSchema.omit({ key: true }))],
    handler: async (request, reply) => {
      const { key } = request.params as { key: string };
      const { content } = request.body as { content: string };
      const result = await context.database.execute(
        'UPDATE portfolio_content SET content = $1, updated_at = $2 WHERE key = $3',
        [content, Date.now(), key]
      );
      if (result.rowCount === 0) {
        return reply.status(404).send({ success: false, error: 'Portfolio content not found', code: 'NOT_FOUND' });
      }
      return { success: true, data: await context.database.queryOne('SELECT * FROM portfolio_content WHERE key = $1', [key]) };
    },
  });
}
