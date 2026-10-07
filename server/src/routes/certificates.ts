import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import { certificateCreateSchema, certificateUpdateSchema, idParamSchema } from '../schemas/index.js';
import type { RouteContext } from './context.js';
import { publicCertificate } from './context.js';

type CertificateInput = {
  name: string;
  issuer: string;
  date: string;
  description?: string | null;
  asset_id?: string | null;
  link?: string | null;
  sort_order: number;
  visibility: boolean;
};

function updateValues(body: Record<string, unknown>): { assignments: string[]; values: unknown[] } {
  const allowed = new Set(['name', 'issuer', 'date', 'description', 'asset_id', 'link', 'sort_order', 'visibility']);
  const assignments: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(body)) {
    if (allowed.has(key)) {
      assignments.push(`${key} = ?`);
      values.push(key === 'visibility' ? (value ? 1 : 0) : value);
    }
  }
  return { assignments, values };
}

export async function certificateRoutes(fastify: FastifyInstance, context: RouteContext): Promise<void> {
  fastify.get('/', async () => {
    const rows = context.database.prepare('SELECT * FROM certificates WHERE visibility = 1 ORDER BY sort_order, date DESC').all() as Array<Record<string, unknown>>;
    return { success: true, data: rows.map(publicCertificate) };
  });
}

export async function certificateAdminRoutes(fastify: FastifyInstance, context: RouteContext): Promise<void> {
  const admin = authenticate(context.authService);
  fastify.get('/', { preHandler: [admin] }, async () => {
    const rows = context.database.prepare('SELECT * FROM certificates ORDER BY sort_order, date DESC').all() as Array<Record<string, unknown>>;
    return { success: true, data: rows.map(publicCertificate) };
  });

  fastify.post('/', {
    preHandler: [admin],
    preValidation: [validateBody(certificateCreateSchema)],
    handler: async (request, reply) => {
      const data = request.body as CertificateInput;
      if (data.asset_id && !context.database.prepare('SELECT 1 FROM assets WHERE id = ?').get(data.asset_id)) {
        return reply.status(400).send({ success: false, error: 'Referenced asset does not exist', code: 'INVALID_ASSET_ID' });
      }
      const id = randomUUID();
      const now = Date.now();
      context.database.prepare(`
        INSERT INTO certificates (id, name, issuer, date, description, asset_id, link, sort_order, visibility, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, data.name, data.issuer, data.date, data.description ?? null, data.asset_id ?? null, data.link ?? null, data.sort_order, data.visibility ? 1 : 0, now, now);
      return reply.status(201).send({ success: true, data: publicCertificate(context.database.prepare('SELECT * FROM certificates WHERE id = ?').get(id) as Record<string, unknown>) });
    },
  });

  fastify.patch('/:id', {
    preHandler: [admin],
    preValidation: [validateParams(idParamSchema), validateBody(certificateUpdateSchema)],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      if (typeof body.asset_id === 'string' && !context.database.prepare('SELECT 1 FROM assets WHERE id = ?').get(body.asset_id)) {
        return reply.status(400).send({ success: false, error: 'Referenced asset does not exist', code: 'INVALID_ASSET_ID' });
      }
      const { assignments, values } = updateValues(body);
      if (assignments.length === 0) {
        return reply.status(400).send({ success: false, error: 'No fields to update', code: 'NO_UPDATES' });
      }
      values.push(Date.now(), id);
      const result = context.database.prepare(`UPDATE certificates SET ${assignments.join(', ')}, updated_at = ? WHERE id = ?`).run(...values);
      if (result.changes === 0) {
        return reply.status(404).send({ success: false, error: 'Certificate not found', code: 'NOT_FOUND' });
      }
      return { success: true, data: publicCertificate(context.database.prepare('SELECT * FROM certificates WHERE id = ?').get(id) as Record<string, unknown>) };
    },
  });

  fastify.delete('/:id', {
    preHandler: [admin],
    preValidation: [validateParams(idParamSchema)],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = context.database.prepare('DELETE FROM certificates WHERE id = ?').run(id);
      if (result.changes === 0) {
        return reply.status(404).send({ success: false, error: 'Certificate not found', code: 'NOT_FOUND' });
      }
      return reply.send({ success: true, message: 'Certificate deleted' });
    },
  });
}
