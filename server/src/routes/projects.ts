import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { randomUUID } from 'crypto';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import { z } from 'zod';

const projectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(500),
  long_description: z.string().optional(),
  technologies: z.array(z.string()).default([]),
  github_url: z.string().url().optional().or(z.literal('')),
  live_url: z.string().url().optional().or(z.literal('')),
  featured_image: z.string().optional(),
  visibility: z.enum(['public', 'hidden']).default('public'),
  featured: z.boolean().default(false),
  sort_order: z.number().int().min(0).default(0),
});

const projectUpdateSchema = projectSchema.partial();

const projectParamsSchema = z.object({
  id: z.string().uuid('Invalid project ID format')
});

export async function projectRoutes(fastify: FastifyInstance) {
  // GET /api/projects - List all public projects
  fastify.get('/', async (request, reply) => {
    const projects = fastify.db.prepare(`
      SELECT * FROM projects WHERE visibility = 'public' ORDER BY sort_order ASC, created_at DESC
    `).all();

    return {
      success: true,
      data: projects
    };
  });

  // GET /api/projects/:id - Get single project
  fastify.get('/:id', {
    schema: { params: projectParamsSchema.shape },
    handler: async (request, reply) => {
      const project = fastify.db.prepare('SELECT * FROM projects WHERE id = ?').get(request.params.id);
      if (!project) {
        return fastify.httpErrors.notFound('Project not found');
      }
      return { success: true, data: project };
    }
  });

  // POST /api/admin/projects - Create project (admin only)
  fastify.post('/admin', {
    preHandler: [authenticate, requireRole('admin')],
    schema: { body: projectSchema.shape },
    preValidation: [validateBody(projectSchema)],
    handler: async (request, reply) => {
      const data = request.body as any;
      const id = crypto.randomUUID();
      const now = Date.now();

      fastify.db.prepare(`
        INSERT INTO projects (id, name, description, long_description, technologies, github_url, live_url, featured_image, visibility, featured, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        request.body.name,
        request.body.description,
        request.body.long_description || null,
        JSON.stringify(request.body.technologies || []),
        request.body.github_url || null,
        request.body.live_url || null,
        request.body.featured_image || null,
        request.body.visibility || 'public',
        request.body.featured ? 1 : 0,
        request.body.sort_order || 0,
        Date.now(),
        Date.now()
      );

      const project = fastify.db.prepare('SELECT * FROM projects WHERE id = ?').get(crypto.randomUUID());
      return reply.status(201).send({ success: true, data: project });
    }
  );

  // PATCH /api/admin/projects/:id - Update project (admin only)
  fastify.patch('/admin/:id', {
    preHandler: [authenticate, requireRole('admin')],
    schema: { params: projectParamsSchema.shape, body: projectUpdateSchema.shape },
    preValidation: [validateParams(projectParamsSchema), validateBody(projectUpdateSchema)],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const updates = request.body as Partial<typeof projectSchema._type>;

      const existing = fastify.db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
      if (!existing) {
        return fastify.httpErrors.notFound('Project not found');
      }

      const updates: string[] = [];
      const values: any[] = [];

      for (const [key, value] of Object.entries(request.body)) {
        if (value !== undefined) {
          updates.push(`${key} = ?`);
          values.push(typeof value === 'object' ? JSON.stringify(value) : value);
        }
      }

      if (updates.length === 0) {
        return reply.status(400).send({ success: false, error: 'No valid fields to update', code: 'NO_UPDATES' });
      }

      values.push(Date.now(), id);
      fastify.db.prepare(`UPDATE projects SET ${updates.join(', ')}, updated_at = ? WHERE id = ?`).run(...values);

      const project = fastify.db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
      return { success: true, data: project };
    }
  });

  // DELETE /api/admin/projects/:id - Delete project (admin only)
  fastify.delete('/admin/:id', {
    preHandler: [authenticate, requireRole('admin')],
    schema: { params: projectParamsSchema.shape },
    preValidation: [validateParams(projectParamsSchema)],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };

      const result = fastify.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
      if (result.changes === 0) {
        return fastify.httpErrors.notFound('Project not found');
      }

      return { success: true, message: 'Project deleted' };
    }
  });

  // GET /api/admin/projects - List all projects (admin, includes hidden)
  fastify.get('/admin', {
    preHandler: [authenticate, requireRole('admin')],
    handler: async (request, reply) => {
      const projects = fastify.db.prepare('SELECT * FROM projects ORDER BY sort_order ASC, created_at DESC').all();
      return { success: true, data: projects };
    }
  });
}