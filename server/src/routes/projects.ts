import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.js';
import {
  idParamSchema,
  projectCreateSchema,
  projectUpdateSchema,
  projectSyncSchema,
  repoContentsQuerySchema,
  repoFileQuerySchema,
} from '../schemas/index.js';
import {
  fetchGitHubRepoMetadata,
  parseGitHubRepo,
  fetchRepoTree,
  fetchRepoFile,
  GitHubSyncError,
} from '../services/github.js';
import type { RouteContext } from './context.js';
import { publicProject } from './context.js';

type ProjectInput = {
  name: string;
  description: string;
  long_description?: string | null;
  technologies: string[];
  github_url?: string | null;
  live_url?: string | null;
  featured_image?: string | null;
  visibility: 'public' | 'hidden';
  featured: boolean;
  sort_order: number;
  github_repo?: string | null;
};

function serializeProject(row: Record<string, unknown>): Record<string, unknown> {
  return publicProject(row);
}

function projectUpdateValues(body: Record<string, unknown>): { assignments: string[]; values: unknown[] } {
  const columns: Record<string, (value: unknown) => unknown> = {
    name: (value) => value,
    description: (value) => value,
    long_description: (value) => value,
    technologies: (value) => JSON.stringify(value),
    github_url: (value) => value,
    live_url: (value) => value,
    featured_image: (value) => value,
    visibility: (value) => value,
    featured: (value) => (value ? 1 : 0),
    sort_order: (value) => value,
    github_repo: (value) => value,
  };
  const assignments: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(body)) {
    const serializer = columns[key];
    if (serializer) {
      values.push(serializer(value));
      assignments.push(`${key} = $${values.length}`);
    }
  }
  return { assignments, values };
}

export async function projectRoutes(fastify: FastifyInstance, context: RouteContext): Promise<void> {
  fastify.get('/', async () => {
    const rows = await context.database.queryAll<Record<string, unknown>>(`
      SELECT * FROM projects WHERE visibility = 'public'
      ORDER BY sort_order ASC, created_at DESC
    `);
    return { success: true, data: rows.map(serializeProject) };
  });

  fastify.get('/:id', {
    preValidation: [validateParams(idParamSchema)],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const row = await context.database.queryOne<Record<string, unknown>>(
        "SELECT * FROM projects WHERE id = $1 AND visibility = 'public'",
        [id]
      );
      if (!row) {
        return reply.status(404).send({ success: false, error: 'Project not found', code: 'NOT_FOUND' });
      }
      return { success: true, data: serializeProject(row) };
    },
  });

  fastify.get('/:id/repository', {
    preValidation: [validateParams(idParamSchema)],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const row = await context.database.queryOne<Record<string, unknown>>(
        "SELECT * FROM projects WHERE id = $1 AND visibility = 'public'",
        [id]
      );
      if (!row) {
        return reply.status(404).send({ success: false, error: 'Project not found', code: 'NOT_FOUND' });
      }
      if (!row.github_repo || typeof row.github_repo !== 'string' || !row.github_repo.trim()) {
        return reply.status(400).send({ success: false, error: 'Project does not have an associated GitHub repository', code: 'NO_REPOSITORY' });
      }
      return {
        success: true,
        data: {
          projectId: row.id,
          projectName: row.name,
          repo: row.github_repo,
          html_url: row.github_url || `https://github.com/${row.github_repo}`,
        },
      };
    },
  });

  fastify.get('/:id/repository/contents', {
    preValidation: [validateParams(idParamSchema), validateQuery(repoContentsQuerySchema)],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const row = await context.database.queryOne<Record<string, unknown>>(
        "SELECT * FROM projects WHERE id = $1 AND visibility = 'public'",
        [id]
      );
      if (!row) {
        return reply.status(404).send({ success: false, error: 'Project not found', code: 'NOT_FOUND' });
      }
      if (!row.github_repo || typeof row.github_repo !== 'string' || !row.github_repo.trim()) {
        return reply.status(400).send({ success: false, error: 'Project does not have an associated GitHub repository', code: 'NO_REPOSITORY' });
      }

      const query = request.query as { path?: string; ref?: string };
      try {
        const items = await fetchRepoTree(row.github_repo, query.path || '', query.ref, context.config.GITHUB_TOKEN);
        return { success: true, data: items };
      } catch (err: unknown) {
        if (err instanceof GitHubSyncError) {
          return reply.status(err.statusCode).send({
            success: false,
            error: err.message,
            code: err.code,
          });
        }
        request.log.error({ err }, 'Failed to fetch repository tree');
        return reply.status(502).send({
          success: false,
          error: 'Failed to communicate with GitHub repository service',
          code: 'NETWORK_ERROR',
        });
      }
    },
  });

  fastify.get('/:id/repository/file', {
    preValidation: [validateParams(idParamSchema), validateQuery(repoFileQuerySchema)],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const row = await context.database.queryOne<Record<string, unknown>>(
        "SELECT * FROM projects WHERE id = $1 AND visibility = 'public'",
        [id]
      );
      if (!row) {
        return reply.status(404).send({ success: false, error: 'Project not found', code: 'NOT_FOUND' });
      }
      if (!row.github_repo || typeof row.github_repo !== 'string' || !row.github_repo.trim()) {
        return reply.status(400).send({ success: false, error: 'Project does not have an associated GitHub repository', code: 'NO_REPOSITORY' });
      }

      const query = request.query as { path: string; ref?: string };
      try {
        const file = await fetchRepoFile(row.github_repo, query.path, query.ref, context.config.GITHUB_TOKEN);
        return { success: true, data: file };
      } catch (err: unknown) {
        if (err instanceof GitHubSyncError) {
          return reply.status(err.statusCode).send({
            success: false,
            error: err.message,
            code: err.code,
          });
        }
        request.log.error({ err }, 'Failed to fetch repository file');
        return reply.status(502).send({
          success: false,
          error: 'Failed to communicate with GitHub repository service',
          code: 'NETWORK_ERROR',
        });
      }
    },
  });
}

export async function projectAdminRoutes(fastify: FastifyInstance, context: RouteContext): Promise<void> {
  const admin = authenticate(context.authService, context.config);

  fastify.get('/', { preHandler: [admin] }, async () => {
    const rows = await context.database.queryAll<Record<string, unknown>>(
      'SELECT * FROM projects ORDER BY sort_order ASC, created_at DESC'
    );
    return { success: true, data: rows.map(serializeProject) };
  });

  fastify.get('/:id', {
    preHandler: [admin],
    preValidation: [validateParams(idParamSchema)],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const row = await context.database.queryOne<Record<string, unknown>>(
        'SELECT * FROM projects WHERE id = $1',
        [id]
      );
      if (!row) {
        return reply.status(404).send({ success: false, error: 'Project not found', code: 'NOT_FOUND' });
      }
      return { success: true, data: serializeProject(row) };
    },
  });

  fastify.post('/', {
    preHandler: [admin],
    preValidation: [validateBody(projectCreateSchema)],
    handler: async (request, reply) => {
      const data = request.body as ProjectInput;
      const id = randomUUID();
      const now = Date.now();
      await context.database.execute(`
        INSERT INTO projects (
          id, name, description, long_description, technologies, github_url, live_url,
          featured_image, visibility, featured, sort_order, github_repo, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        )
      `, [
        id, data.name, data.description, data.long_description ?? null,
        JSON.stringify(data.technologies), data.github_url ?? null, data.live_url ?? null,
        data.featured_image ?? null, data.visibility, data.featured ? 1 : 0, data.sort_order,
        data.github_repo ?? null, now, now
      ]);
      const created = await context.database.queryOne<Record<string, unknown>>(
        'SELECT * FROM projects WHERE id = $1',
        [id]
      );
      return reply.status(201).send({ success: true, data: serializeProject(created as Record<string, unknown>) });
    },
  });

  fastify.post('/:id/github-sync', {
    preHandler: [admin],
    preValidation: [validateParams(idParamSchema), validateBody(projectSyncSchema)],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const row = await context.database.queryOne<Record<string, unknown>>(
        'SELECT * FROM projects WHERE id = $1',
        [id]
      );
      if (!row) {
        return reply.status(404).send({ success: false, error: 'Project not found', code: 'NOT_FOUND' });
      }

      const body = (request.body || {}) as { github_repo?: string };
      const candidate = body.github_repo || (typeof row.github_repo === 'string' ? row.github_repo : '') || (typeof row.github_url === 'string' ? row.github_url : '');
      const repo = parseGitHubRepo(candidate);

      if (!repo) {
        return reply.status(400).send({
          success: false,
          error: 'No valid GitHub repository specified for this project. Please provide an "owner/repo" or GitHub URL.',
          code: 'INVALID_REPO',
        });
      }

      try {
        const meta = await fetchGitHubRepoMetadata(repo, context.config.GITHUB_TOKEN);
        const now = Date.now();
        const githubUrl = row.github_url || meta.html_url;

        await context.database.execute(`
          UPDATE projects SET
            github_repo = $1,
            github_stars = $2,
            github_forks = $3,
            github_language = $4,
            github_topics = $5,
            github_updated_at = $6,
            github_sync_status = 'synced',
            github_synced_at = $7,
            github_url = $8,
            updated_at = $9
          WHERE id = $10
        `, [
          meta.repo,
          meta.stars,
          meta.forks,
          meta.language,
          JSON.stringify(meta.topics),
          meta.updated_at,
          now,
          githubUrl,
          now,
          id
        ]);

        const updated = await context.database.queryOne<Record<string, unknown>>(
          'SELECT * FROM projects WHERE id = $1',
          [id]
        );
        return reply.send({ success: true, data: serializeProject(updated as Record<string, unknown>) });
      } catch (err: unknown) {
        const now = Date.now();
        await context.database.execute(
          "UPDATE projects SET github_sync_status = 'failed', updated_at = $1 WHERE id = $2",
          [now, id]
        );

        if (err instanceof GitHubSyncError) {
          return reply.status(err.statusCode).send({
            success: false,
            error: err.message,
            code: err.code,
          });
        }

        request.log.error({ err }, 'Unexpected error during GitHub synchronization');
        return reply.status(502).send({
          success: false,
          error: 'Failed to synchronize with GitHub due to an internal error',
          code: 'NETWORK_ERROR',
        });
      }
    },
  });

  fastify.patch('/:id', {
    preHandler: [admin],
    preValidation: [validateParams(idParamSchema), validateBody(projectUpdateSchema)],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const { assignments, values } = projectUpdateValues(request.body as Record<string, unknown>);
      if (assignments.length === 0) {
        return reply.status(400).send({ success: false, error: 'No fields to update', code: 'NO_UPDATES' });
      }
      values.push(Date.now());
      const updatedAtIdx = values.length;
      values.push(id);
      const idIdx = values.length;

      const result = await context.database.execute(
        `UPDATE projects SET ${assignments.join(', ')}, updated_at = $${updatedAtIdx} WHERE id = $${idIdx}`,
        values
      );
      if (result.rowCount === 0) {
        return reply.status(404).send({ success: false, error: 'Project not found', code: 'NOT_FOUND' });
      }
      const updated = await context.database.queryOne<Record<string, unknown>>(
        'SELECT * FROM projects WHERE id = $1',
        [id]
      );
      return { success: true, data: serializeProject(updated as Record<string, unknown>) };
    },
  });

  fastify.delete('/:id', {
    preHandler: [admin],
    preValidation: [validateParams(idParamSchema)],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await context.database.execute('DELETE FROM projects WHERE id = $1', [id]);
      if (result.rowCount === 0) {
        return reply.status(404).send({ success: false, error: 'Project not found', code: 'NOT_FOUND' });
      }
      return reply.send({ success: true, message: 'Project deleted' });
    },
  });
}
