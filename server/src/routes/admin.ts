import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { randomUUID } from 'crypto';

export async function adminRoutes(fastify: FastifyInstance) {
  fastify.get('/dashboard', { preHandler: [authenticate, requireRole('admin')] }, async (request, reply) => {
    const stats = {
      users: db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number },
      projects: db.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number },
      skills: db.prepare('SELECT COUNT(*) as count FROM skills').get() as { count: number },
      experience: db.prepare('SELECT COUNT(*) as count FROM experience').get() as { count: number },
      certificates: db.prepare('SELECT COUNT(*) as count FROM certificates').get() as { count: number },
      assets: db.prepare('SELECT COUNT(*) as count FROM assets').get() as { count: number },
      visitors: db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('visitor') as { count: number },
      sessions: db.prepare('SELECT COUNT(*) as count FROM sessions WHERE expires_at > ?').get(Date.now()) as { count: number },
      wallpaper: db.prepare('SELECT value FROM site_config WHERE key = ?').get('wallpaper_url') as { value: string } | undefined,
    };

    return { success: true, data: stats };
  }

  fastify.get('/stats', { preHandler: [authenticate, requireRole('admin')] }, async (request, reply) => {
    const stats = {
      users: db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number },
      projects: db.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number },
      skills: db.prepare('SELECT COUNT(*) as count FROM skills').get() as { count: number },
      experience: db.prepare('SELECT COUNT(*) as count FROM experience').get() as { count: number },
      certificates: db.prepare('SELECT COUNT(*) as count FROM certificates').get() as { count: number },
      assets: db.prepare('SELECT COUNT(*) as count FROM assets').get() as { count: number },
    };
    return { success: true, data: stats };
  });

  fastify.get('/config', { preHandler: [authenticate, requireRole('admin')] }, async (request, reply) => {
    const config = db.prepare('SELECT * FROM site_config').all();
    return { success: true, data: config };
  });

  fastify.patch('/config/:key', { preHandler: [authenticate, requireRole('admin')] }, async (request, reply) => {
    const { value } = request.body as { value: string };
    const { key } = request.params as { key: string };

    db.prepare('UPDATE site_config SET value = ?, updated_at = ? WHERE key = ?').run(request.body.value, Date.now(), request.params.key);

    const config = db.prepare('SELECT * FROM site_config WHERE key = ?').get(request.params.key);
    return { success: true, data: config };
  });

  fastify.post('/config', { preHandler: [authenticate, requireRole('admin')] }, async (request, reply) => {
    const { key, value, description } = request.body as { key: string; value: string; description?: string };

    db.prepare('INSERT OR REPLACE INTO site_config (key, value, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(request.body.key, request.body.value, request.body.description || '', Date.now(), Date.now());

    return { success: true, message: 'Configuration saved' };
  });
}