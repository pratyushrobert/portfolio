import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { z } from 'zod';

export async function portfolioRoutes(fastify: FastifyInstance) {
  // GET /api/portfolio - Get all portfolio content
  fastify.get('/portfolio', async (request, reply) => {
    const content = db.prepare('SELECT key, content FROM portfolio_content').all() as { key: string; content: string }[];
    const contentMap = Object.fromEntries(content.map(c => [c.key, c.content]));

    return {
      success: true,
      data: contentMap
    };
  });

  // GET /api/portfolio/:key - Get specific portfolio content
  fastify.get('/portfolio/:key', {
    schema: {
      params: z.object({
        key: z.string().min(1)
      })
    },
    handler: async (request, reply) => {
      const { key } = request.params as { key: string };
      const content = db.prepare('SELECT key, content FROM portfolio_content WHERE key = ?').get(request.params.key);

      if (!content) {
        return fastify.httpErrors.notFound(`Content with key "${request.params.key}" not found`);
      }

      return {
        success: true,
        data: { key: content.key, content: content.content }
      };
    }
  });
}