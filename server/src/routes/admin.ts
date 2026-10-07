import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import type { RouteContext } from './context.js';

export async function adminRoutes(fastify: FastifyInstance, context: RouteContext): Promise<void> {
  const allowedTables = new Set(['projects', 'skills', 'experience', 'certificates', 'assets']);
  fastify.get('/dashboard', { preHandler: [authenticate(context.authService)] }, async () => {
    const count = (table: string): number => {
      if (!allowedTables.has(table)) {
        throw new Error(`Invalid table: ${table}`);
      }
      const row = context.database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number };
      return row.count;
    };

    const countQuery = (sql: string): number => {
      const row = context.database.prepare(sql).get() as { count: number };
      return row ? row.count : 0;
    };

    return {
      success: true,
      data: {
        projects: count('projects'),
        projects_public: countQuery("SELECT COUNT(*) AS count FROM projects WHERE visibility = 'public'"),
        projects_featured: countQuery("SELECT COUNT(*) AS count FROM projects WHERE featured = 1"),
        skills: count('skills'),
        skills_public: countQuery("SELECT COUNT(*) AS count FROM skills WHERE visibility = 1"),
        experience: count('experience'),
        experience_public: countQuery("SELECT COUNT(*) AS count FROM experience WHERE visibility = 1"),
        certificates: count('certificates'),
        certificates_public: countQuery("SELECT COUNT(*) AS count FROM certificates WHERE visibility = 1"),
        assets: count('assets'),
        active_sessions: countQuery(`SELECT COUNT(*) AS count FROM sessions WHERE expires_at > ${Date.now()}`),
        github_linked_projects: countQuery("SELECT COUNT(*) AS count FROM projects WHERE github_repo IS NOT NULL AND trim(github_repo) != ''"),
        github_synced_projects: countQuery("SELECT COUNT(*) AS count FROM projects WHERE github_sync_status = 'synced'"),
        github_username: context.config.GITHUB_USERNAME,
      },
    };
  });
}
