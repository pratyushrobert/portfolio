import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';

export async function configRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (request, reply) => {
    const config = db.prepare('SELECT key, value FROM site_config').all();
    const configMap = Object.fromEntries(config.map(c => [c.key, c.value]));
    return { success: true, data: configMap };
  });

  fastify.get('/:key', async (request, reply) => {
    const { key } = request.params as { key: string };
    const config = db.prepare('SELECT key, value FROM site_config WHERE key = ?').get(request.params.key);

    if (!config) {
      return fastify.httpErrors.notFound(`Config key "${request.params.key}" not found`);
    }

    return { success: true, data: config };
  });
}