import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import { configKeySchema, configPatchSchema, configSinglePatchSchema } from '../schemas/index.js';
import type { RouteContext } from './context.js';

export async function configRoutes(fastify: FastifyInstance, context: RouteContext): Promise<void> {
  fastify.get('/', async () => {
    const rows = context.database.prepare('SELECT key, value FROM site_config ORDER BY key').all() as Array<{ key: string; value: string }>;
    return { success: true, data: Object.fromEntries(rows.map((row) => [row.key, row.value])) };
  });

  fastify.get('/:key', {
    preValidation: [validateParams(configKeySchema)],
    handler: async (request, reply) => {
      const { key } = request.params as { key: string };
      const row = context.database.prepare('SELECT key, value FROM site_config WHERE key = ?').get(key);
      if (!row) {
        return reply.status(404).send({ success: false, error: 'Configuration key not found', code: 'NOT_FOUND' });
      }
      return { success: true, data: row };
    },
  });
}

export async function configAdminRoutes(fastify: FastifyInstance, context: RouteContext): Promise<void> {
  fastify.get('/', { preHandler: [authenticate(context.authService)] }, async () => {
    return { success: true, data: context.database.prepare('SELECT * FROM site_config ORDER BY key').all() };
  });

  fastify.patch('/', {
    preHandler: [authenticate(context.authService)],
    preValidation: [validateBody(configPatchSchema)],
    handler: async (request, reply) => {
      const now = Date.now();
      const items = Array.isArray(request.body)
        ? (request.body as Array<{ key: string; value: string; description?: string | null }>)
        : [request.body as { key: string; value: string; description?: string | null }];

      const stmt = context.database.prepare(`
        INSERT INTO site_config (key, value, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, description = excluded.description, updated_at = excluded.updated_at
      `);

      const runBatch = context.database.transaction((entries: typeof items) => {
        for (const item of entries) {
          stmt.run(item.key, item.value, item.description ?? null, now, now);
        }
      });
      runBatch(items);

      if (Array.isArray(request.body)) {
        return reply.send({ success: true, data: context.database.prepare('SELECT * FROM site_config ORDER BY key').all() });
      }

      const single = request.body as { key: string; value: string; description?: string | null };
      return reply.send({ success: true, data: context.database.prepare('SELECT * FROM site_config WHERE key = ?').get(single.key) });
    },
  });

  fastify.patch('/:key', {
    preHandler: [authenticate(context.authService)],
    preValidation: [validateParams(configKeySchema), validateBody(configSinglePatchSchema.omit({ key: true }))],
    handler: async (request, reply) => {
      const { key } = request.params as { key: string };
      const { value, description } = request.body as { value: string; description?: string | null };
      const result = context.database.prepare('UPDATE site_config SET value = ?, description = COALESCE(?, description), updated_at = ? WHERE key = ?')
        .run(value, description ?? null, Date.now(), key);
      if (result.changes === 0) {
        return reply.status(404).send({ success: false, error: 'Configuration key not found', code: 'NOT_FOUND' });
      }
      return { success: true, data: context.database.prepare('SELECT * FROM site_config WHERE key = ?').get(key) };
    },
  });
}
