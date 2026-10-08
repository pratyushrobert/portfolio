import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import { experienceCreateSchema, experienceUpdateSchema, idParamSchema } from '../schemas/index.js';
import type { RouteContext } from './context.js';
import { publicExperience } from './context.js';

type ExperienceInput = {
  organization: string;
  role: string;
  start_date: string;
  end_date?: string | null;
  description: string;
  technologies: string[];
  link?: string | null;
  sort_order: number;
  visibility: boolean;
};

function updateValues(body: Record<string, unknown>): { assignments: string[]; values: unknown[] } {
  const allowed = new Set(['organization', 'role', 'start_date', 'end_date', 'description', 'technologies', 'link', 'sort_order', 'visibility']);
  const assignments: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(body)) {
    if (allowed.has(key)) {
      values.push(key === 'technologies' ? JSON.stringify(value) : key === 'visibility' ? (value ? 1 : 0) : value);
      assignments.push(`${key} = $${values.length}`);
    }
  }
  return { assignments, values };
}

export async function experienceRoutes(fastify: FastifyInstance, context: RouteContext): Promise<void> {
  fastify.get('/', async () => {
    const rows = await context.database.queryAll<Record<string, unknown>>(
      'SELECT * FROM experience WHERE visibility = 1 ORDER BY sort_order, start_date DESC'
    );
    return { success: true, data: rows.map(publicExperience) };
  });
}

export async function experienceAdminRoutes(fastify: FastifyInstance, context: RouteContext): Promise<void> {
  const admin = authenticate(context.authService);
  fastify.get('/', { preHandler: [admin] }, async () => {
    const rows = await context.database.queryAll<Record<string, unknown>>(
      'SELECT * FROM experience ORDER BY sort_order, start_date DESC'
    );
    return { success: true, data: rows.map(publicExperience) };
  });

  fastify.post('/', {
    preHandler: [admin],
    preValidation: [validateBody(experienceCreateSchema)],
    handler: async (request, reply) => {
      const data = request.body as ExperienceInput;
      const id = randomUUID();
      const now = Date.now();
      await context.database.execute(`
        INSERT INTO experience (id, organization, role, start_date, end_date, description, technologies, link, sort_order, visibility, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [id, data.organization, data.role, data.start_date, data.end_date ?? null, data.description, JSON.stringify(data.technologies), data.link ?? null,
        data.sort_order, data.visibility ? 1 : 0, now, now]);
      const created = await context.database.queryOne<Record<string, unknown>>('SELECT * FROM experience WHERE id = $1', [id]);
      return reply.status(201).send({ success: true, data: publicExperience(created as Record<string, unknown>) });
    },
  });

  fastify.patch('/:id', {
    preHandler: [admin],
    preValidation: [validateParams(idParamSchema), validateBody(experienceUpdateSchema)],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const { assignments, values } = updateValues(request.body as Record<string, unknown>);
      if (assignments.length === 0) {
        return reply.status(400).send({ success: false, error: 'No fields to update', code: 'NO_UPDATES' });
      }
      values.push(Date.now());
      const updatedAtIdx = values.length;
      values.push(id);
      const idIdx = values.length;

      const result = await context.database.execute(
        `UPDATE experience SET ${assignments.join(', ')}, updated_at = $${updatedAtIdx} WHERE id = $${idIdx}`,
        values
      );
      if (result.rowCount === 0) {
        return reply.status(404).send({ success: false, error: 'Experience not found', code: 'NOT_FOUND' });
      }
      const updated = await context.database.queryOne<Record<string, unknown>>('SELECT * FROM experience WHERE id = $1', [id]);
      return { success: true, data: publicExperience(updated as Record<string, unknown>) };
    },
  });

  fastify.delete('/:id', {
    preHandler: [admin],
    preValidation: [validateParams(idParamSchema)],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await context.database.execute('DELETE FROM experience WHERE id = $1', [id]);
      if (result.rowCount === 0) {
        return reply.status(404).send({ success: false, error: 'Experience not found', code: 'NOT_FOUND' });
      }
      return reply.send({ success: true, message: 'Experience deleted' });
    },
  });
}
