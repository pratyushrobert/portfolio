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
      values.push(key === 'visibility' ? (value ? 1 : 0) : value);
      assignments.push(`${key} = $${values.length}`);
    }
  }
  return { assignments, values };
}

export async function certificateRoutes(fastify: FastifyInstance, context: RouteContext): Promise<void> {
  fastify.get('/', async () => {
    const rows = await context.database.queryAll<Record<string, unknown>>(
      'SELECT * FROM certificates WHERE visibility = 1 ORDER BY sort_order, date DESC'
    );
    return { success: true, data: rows.map(publicCertificate) };
  });
}

export async function certificateAdminRoutes(fastify: FastifyInstance, context: RouteContext): Promise<void> {
  const admin = authenticate(context.authService);
  fastify.get('/', { preHandler: [admin] }, async () => {
    const rows = await context.database.queryAll<Record<string, unknown>>(
      'SELECT * FROM certificates ORDER BY sort_order, date DESC'
    );
    return { success: true, data: rows.map(publicCertificate) };
  });

  fastify.post('/', {
    preHandler: [admin],
    preValidation: [validateBody(certificateCreateSchema)],
    handler: async (request, reply) => {
      const data = request.body as CertificateInput;
      if (data.asset_id) {
        const assetExists = await context.database.queryOne('SELECT 1 FROM assets WHERE id = $1', [data.asset_id]);
        if (!assetExists) {
          return reply.status(400).send({ success: false, error: 'Referenced asset does not exist', code: 'INVALID_ASSET_ID' });
        }
      }
      const id = randomUUID();
      const now = Date.now();
      await context.database.execute(`
        INSERT INTO certificates (id, name, issuer, date, description, asset_id, link, sort_order, visibility, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [id, data.name, data.issuer, data.date, data.description ?? null, data.asset_id ?? null, data.link ?? null, data.sort_order, data.visibility ? 1 : 0, now, now]);
      const created = await context.database.queryOne<Record<string, unknown>>('SELECT * FROM certificates WHERE id = $1', [id]);
      return reply.status(201).send({ success: true, data: publicCertificate(created as Record<string, unknown>) });
    },
  });

  fastify.patch('/:id', {
    preHandler: [admin],
    preValidation: [validateParams(idParamSchema), validateBody(certificateUpdateSchema)],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      if (typeof body.asset_id === 'string') {
        const assetExists = await context.database.queryOne('SELECT 1 FROM assets WHERE id = $1', [body.asset_id]);
        if (!assetExists) {
          return reply.status(400).send({ success: false, error: 'Referenced asset does not exist', code: 'INVALID_ASSET_ID' });
        }
      }
      const { assignments, values } = updateValues(body);
      if (assignments.length === 0) {
        return reply.status(400).send({ success: false, error: 'No fields to update', code: 'NO_UPDATES' });
      }
      values.push(Date.now());
      const updatedAtIdx = values.length;
      values.push(id);
      const idIdx = values.length;

      const result = await context.database.execute(
        `UPDATE certificates SET ${assignments.join(', ')}, updated_at = $${updatedAtIdx} WHERE id = $${idIdx}`,
        values
      );
      if (result.rowCount === 0) {
        return reply.status(404).send({ success: false, error: 'Certificate not found', code: 'NOT_FOUND' });
      }
      const updated = await context.database.queryOne<Record<string, unknown>>('SELECT * FROM certificates WHERE id = $1', [id]);
      return { success: true, data: publicCertificate(updated as Record<string, unknown>) };
    },
  });

  fastify.delete('/:id', {
    preHandler: [admin],
    preValidation: [validateParams(idParamSchema)],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await context.database.execute('DELETE FROM certificates WHERE id = $1', [id]);
      if (result.rowCount === 0) {
        return reply.status(404).send({ success: false, error: 'Certificate not found', code: 'NOT_FOUND' });
      }
      return reply.send({ success: true, message: 'Certificate deleted' });
    },
  });
}
