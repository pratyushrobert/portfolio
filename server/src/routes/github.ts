import type { FastifyInstance } from 'fastify';
import { validateParams, validateQuery } from '../middleware/validation.js';
import {
  repoParamSchema,
  repoListQuerySchema,
  repoContentsQuerySchema,
  repoFileQuerySchema,
} from '../schemas/index.js';
import {
  fetchUserRepositories,
  fetchGitHubRepoMetadata,
  fetchRepoTree,
  fetchRepoFile,
  validateRepoName,
  GitHubSyncError,
} from '../services/github.js';
import type { RouteContext } from './context.js';

export async function githubRoutes(fastify: FastifyInstance, context: RouteContext): Promise<void> {
  // GET /api/github/repos - Discover all public repositories belonging to configured GITHUB_USERNAME
  fastify.get('/repos', {
    preValidation: [validateQuery(repoListQuerySchema)],
    handler: async (request, reply) => {
      const query = request.query as { refresh?: boolean };
      try {
        const repos = await fetchUserRepositories(
          context.config.GITHUB_USERNAME,
          context.config.GITHUB_TOKEN,
          Boolean(query?.refresh)
        );
        return { success: true, data: repos };
      } catch (err: unknown) {
        if (err instanceof GitHubSyncError) {
          // Upstream GitHub rate limits or errors must never be returned as 403 Forbidden.
          // 403 implies client authorization failure; upstream rate limit is 429.
          const status = err.statusCode === 403 ? 429 : err.statusCode;
          return reply.status(status).send({
            success: false,
            error: err.message,
            code: err.code,
            source: 'github_upstream',
          });
        }
        request.log.error({ err }, 'Failed to fetch user repositories');
        return reply.status(502).send({
          success: false,
          error: 'Failed to communicate with GitHub API',
          code: 'NETWORK_ERROR',
          source: 'github_upstream',
        });
      }
    },
  });

  // GET /api/github/repos/:repo - Get metadata for a specific repository of GITHUB_USERNAME
  fastify.get('/repos/:repo', {
    preValidation: [validateParams(repoParamSchema)],
    handler: async (request, reply) => {
      const { repo } = request.params as { repo: string };
      const safeRepoName = validateRepoName(repo);
      const targetRepo = `${context.config.GITHUB_USERNAME}/${safeRepoName}`;

      try {
        const meta = await fetchGitHubRepoMetadata(targetRepo, context.config.GITHUB_TOKEN);
        return { success: true, data: meta };
      } catch (err: unknown) {
        if (err instanceof GitHubSyncError) {
          const status = err.statusCode === 403 ? 429 : err.statusCode;
          return reply.status(status).send({
            success: false,
            error: err.message,
            code: err.code,
            source: 'github_upstream',
          });
        }
        request.log.error({ err }, 'Failed to fetch repository metadata');
        return reply.status(502).send({
          success: false,
          error: 'Failed to communicate with GitHub API',
          code: 'NETWORK_ERROR',
          source: 'github_upstream',
        });
      }
    },
  });

  // GET /api/github/repos/:repo/contents - Browse directory contents of a discovered repo
  fastify.get('/repos/:repo/contents', {
    preValidation: [validateParams(repoParamSchema), validateQuery(repoContentsQuerySchema)],
    handler: async (request, reply) => {
      const { repo } = request.params as { repo: string };
      const safeRepoName = validateRepoName(repo);
      const targetRepo = `${context.config.GITHUB_USERNAME}/${safeRepoName}`;
      const query = request.query as { path?: string; ref?: string };

      try {
        const items = await fetchRepoTree(targetRepo, query.path || '', query.ref, context.config.GITHUB_TOKEN);
        return { success: true, data: items };
      } catch (err: unknown) {
        if (err instanceof GitHubSyncError) {
          const status = err.statusCode === 403 ? 429 : err.statusCode;
          return reply.status(status).send({
            success: false,
            error: err.message,
            code: err.code,
            source: 'github_upstream',
          });
        }
        request.log.error({ err }, 'Failed to fetch repository contents');
        return reply.status(502).send({
          success: false,
          error: 'Failed to communicate with GitHub repository service',
          code: 'NETWORK_ERROR',
          source: 'github_upstream',
        });
      }
    },
  });

  // GET /api/github/repos/:repo/file - View single file content of a discovered repo
  fastify.get('/repos/:repo/file', {
    preValidation: [validateParams(repoParamSchema), validateQuery(repoFileQuerySchema)],
    handler: async (request, reply) => {
      const { repo } = request.params as { repo: string };
      const safeRepoName = validateRepoName(repo);
      const targetRepo = `${context.config.GITHUB_USERNAME}/${safeRepoName}`;
      const query = request.query as { path: string; ref?: string };

      try {
        const file = await fetchRepoFile(targetRepo, query.path, query.ref, context.config.GITHUB_TOKEN);
        return { success: true, data: file };
      } catch (err: unknown) {
        if (err instanceof GitHubSyncError) {
          const status = err.statusCode === 403 ? 429 : err.statusCode;
          return reply.status(status).send({
            success: false,
            error: err.message,
            code: err.code,
            source: 'github_upstream',
          });
        }
        request.log.error({ err }, 'Failed to fetch repository file');
        return reply.status(502).send({
          success: false,
          error: 'Failed to communicate with GitHub repository service',
          code: 'NETWORK_ERROR',
          source: 'github_upstream',
        });
      }
    },
  });
}
