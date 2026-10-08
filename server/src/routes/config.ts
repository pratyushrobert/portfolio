import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import { configKeySchema, configPatchSchema, configSinglePatchSchema } from '../schemas/index.js';
import type { RouteContext } from './context.js';

export async function configRoutes(fastify: FastifyInstance, context: RouteContext): Promise<void> {
  fastify.get('/', async () => {
    const rows = await context.database.queryAll<{ key: string; value: string }>(
      'SELECT key, value FROM site_config ORDER BY key'
    );
    return { success: true, data: Object.fromEntries(rows.map((row) => [row.key, row.value])) };
  });

  fastify.get('/:key', {
    preValidation: [validateParams(configKeySchema)],
    handler: async (request, reply) => {
      const { key } = request.params as { key: string };
      const row = await context.database.queryOne(
        'SELECT key, value FROM site_config WHERE key = $1',
        [key]
      );
      if (!row) {
        return reply.status(404).send({ success: false, error: 'Configuration key not found', code: 'NOT_FOUND' });
      }
      return { success: true, data: row };
    },
  });
}

export async function configAdminRoutes(fastify: FastifyInstance, context: RouteContext): Promise<void> {
  fastify.get('/', { preHandler: [authenticate(context.authService)] }, async () => {
    const rows = await context.database.queryAll('SELECT * FROM site_config ORDER BY key');
    return { success: true, data: rows };
  });

  fastify.patch('/', {
    preHandler: [authenticate(context.authService)],
    preValidation: [validateBody(configPatchSchema)],
    handler: async (request, reply) => {
      const now = Date.now();
      const items = Array.isArray(request.body)
        ? (request.body as Array<{ key: string; value: string; description?: string | null }>)
        : [request.body as { key: string; value: string; description?: string | null }];

      await context.database.transaction(async (tx) => {
        for (const item of items) {
          await tx.execute(`
            INSERT INTO site_config (key, value, description, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description, updated_at = EXCLUDED.updated_at
          `, [item.key, item.value, item.description ?? null, now, now]);
        }
      });

      if (Array.isArray(request.body)) {
        const all = await context.database.queryAll('SELECT * FROM site_config ORDER BY key');
        return reply.send({ success: true, data: all });
      }

      const single = request.body as { key: string; value: string; description?: string | null };
      const updated = await context.database.queryOne('SELECT * FROM site_config WHERE key = $1', [single.key]);
      return reply.send({ success: true, data: updated });
    },
  });

  fastify.patch('/:key', {
    preHandler: [authenticate(context.authService)],
    preValidation: [validateParams(configKeySchema), validateBody(configSinglePatchSchema.omit({ key: true }))],
    handler: async (request, reply) => {
      const { key } = request.params as { key: string };
      const { value, description } = request.body as { value: string; description?: string | null };
      const result = await context.database.execute(
        'UPDATE site_config SET value = $1, description = COALESCE($2, description), updated_at = $3 WHERE key = $4',
        [value, description ?? null, Date.now(), key]
      );
      if (result.rowCount === 0) {
        return reply.status(404).send({ success: false, error: 'Configuration key not found', code: 'NOT_FOUND' });
      }
      const row = await context.database.queryOne('SELECT * FROM site_config WHERE key = $1', [key]);
      return { success: true, data: row };
    },
  });
}
