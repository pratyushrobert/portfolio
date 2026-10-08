import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { SESSION_COOKIE_NAME, getSessionCookieOptions } from '../services/auth.js';
import type { RouteContext } from './context.js';

export async function adminRoutes(fastify: FastifyInstance, context: RouteContext): Promise<void> {
  const allowedTables = new Set(['projects', 'skills', 'experience', 'certificates', 'assets']);

  fastify.get('/dashboard', { preHandler: [authenticate(context.authService, context.config)] }, async () => {
    const count = async (table: string): Promise<number> => {
      if (!allowedTables.has(table)) {
        throw new Error(`Invalid table: ${table}`);
      }
      const row = await context.database.queryOne<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table}`);
      return row ? Number(row.count) : 0;
    };

    const countQuery = async (sql: string, params: unknown[] = []): Promise<number> => {
      const row = await context.database.queryOne<{ count: number }>(sql, params);
      return row ? Number(row.count) : 0;
    };

    const [
      projects,
      projects_public,
      projects_featured,
      skills,
      skills_public,
      experience,
      experience_public,
      certificates,
      certificates_public,
      assets,
      active_sessions,
      github_linked_projects,
      github_synced_projects,
    ] = await Promise.all([
      count('projects'),
      countQuery("SELECT COUNT(*) AS count FROM projects WHERE visibility = 'public'"),
      countQuery('SELECT COUNT(*) AS count FROM projects WHERE featured = 1'),
      count('skills'),
      countQuery('SELECT COUNT(*) AS count FROM skills WHERE visibility = 1'),
      count('experience'),
      countQuery('SELECT COUNT(*) AS count FROM experience WHERE visibility = 1'),
      count('certificates'),
      countQuery('SELECT COUNT(*) AS count FROM certificates WHERE visibility = 1'),
      count('assets'),
      countQuery('SELECT COUNT(*) AS count FROM sessions WHERE expires_at > $1', [Date.now()]),
      countQuery("SELECT COUNT(*) AS count FROM projects WHERE github_repo IS NOT NULL AND trim(github_repo) != ''"),
      countQuery("SELECT COUNT(*) AS count FROM projects WHERE github_sync_status = 'synced'"),
    ]);

    return {
      success: true,
      data: {
        projects,
        projects_public,
        projects_featured,
        skills,
        skills_public,
        experience,
        experience_public,
        certificates,
        certificates_public,
        assets,
        active_sessions,
        github_linked_projects,
        github_synced_projects,
        github_username: context.config.GITHUB_USERNAME,
      },
    };
  });

  fastify.post('/sessions/logout-all', {
    preHandler: [authenticate(context.authService, context.config)],
  }, async (_request, reply) => {
    const invalidatedCount = await context.authService.deleteAllAdminSessions();
    const cookieOptions = getSessionCookieOptions(context.config);
    reply.clearCookie(SESSION_COOKIE_NAME, cookieOptions);
    return reply.send({
      success: true,
      data: { invalidated_sessions: invalidatedCount },
      message: 'All admin sessions invalidated successfully',
    });
  });
}
