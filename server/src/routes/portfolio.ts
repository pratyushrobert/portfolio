import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { authenticate } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import { keyParamSchema, portfolioPatchSchema } from '../schemas/index.js';
import type { RouteContext } from './context.js';

export async function portfolioRoutes(fastify: FastifyInstance, context: RouteContext): Promise<void> {
  fastify.get('/', async () => {
    const rows = context.database.prepare('SELECT key, content FROM portfolio_content ORDER BY key').all() as Array<{ key: string; content: string }>;
    return { success: true, data: Object.fromEntries(rows.map((row) => [row.key, row.content])) };
  });

  fastify.get('/:key', {
    preValidation: [validateParams(keyParamSchema)],
    handler: async (request, reply) => {
      const { key } = request.params as { key: string };
      const content = context.database.prepare('SELECT key, content FROM portfolio_content WHERE key = ?').get(key) as
        | { key: string; content: string }
        | undefined;
      if (!content) {
        return reply.status(404).send({ success: false, error: 'Portfolio content not found', code: 'NOT_FOUND' });
      }
      return { success: true, data: content };
    },
  });

}

export async function portfolioAdminRoutes(fastify: FastifyInstance, context: RouteContext): Promise<void> {
  fastify.get('/', { preHandler: [authenticate(context.authService)] }, async () => {
    const rows = context.database.prepare('SELECT * FROM portfolio_content ORDER BY key').all();
    return { success: true, data: rows };
  });

  fastify.patch('/', {
    preHandler: [authenticate(context.authService)],
    preValidation: [validateBody(portfolioPatchSchema)],
    handler: async (request, reply) => {
      const { key, content } = request.body as { key: string; content: string };
      const now = Date.now();
      context.database.prepare(`
        INSERT INTO portfolio_content (id, key, content, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
      `).run(randomUUID(), key, content, now, now);
      const saved = context.database.prepare('SELECT * FROM portfolio_content WHERE key = ?').get(key);
      return reply.send({ success: true, data: saved });
    },
  });

  fastify.patch('/:key', {
    preHandler: [authenticate(context.authService)],
    preValidation: [validateParams(keyParamSchema), validateBody(portfolioPatchSchema.omit({ key: true }))],
    handler: async (request, reply) => {
      const { key } = request.params as { key: string };
      const { content } = request.body as { content: string };
      const result = context.database.prepare('UPDATE portfolio_content SET content = ?, updated_at = ? WHERE key = ?')
        .run(content, Date.now(), key);
      if (result.changes === 0) {
        return reply.status(404).send({ success: false, error: 'Portfolio content not found', code: 'NOT_FOUND' });
      }
      return { success: true, data: context.database.prepare('SELECT * FROM portfolio_content WHERE key = ?').get(key) };
    },
  });
}
