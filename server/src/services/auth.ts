import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { AppDatabase } from '../db/index.js';
import type { AuthUser, Session } from '../types/index.js';

export const SESSION_COOKIE_NAME = 'mimios_session';
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export interface SessionCookieConfig {
  NODE_ENV: string;
  COOKIE_SAME_SITE?: 'lax' | 'none' | 'strict';
  COOKIE_SECURE?: boolean;
}

export function getSessionCookieOptions(config: SessionCookieConfig) {
  const isProduction = config.NODE_ENV === 'production';
  const sameSite: 'none' | 'lax' | 'strict' = config.COOKIE_SAME_SITE ?? (isProduction ? 'none' : 'lax');
  const secure: boolean = sameSite === 'none' ? true : (config.COOKIE_SECURE ?? isProduction);

  return {
    httpOnly: true,
    signed: true,
    path: '/',
    secure,
    sameSite,
  };
}

type StoredUser = AuthUser & { password_hash: string };

export interface AuthService {
  verifyCredentials(email: string, password: string): Promise<AuthUser | null>;
  createSession(userId: string): Promise<Session>;
  getUserFromSession(sessionId: string): Promise<AuthUser | null>;
  deleteSession(sessionId: string): Promise<void>;
  deleteExpiredSessions(): Promise<void>;
  deleteAllAdminSessions(): Promise<number>;
}

// Constant-time dummy hash to prevent email enumeration via timing side-channels
const DUMMY_HASH = '$2a$12$lHjbCXof903VQtVBoQVtgOxLjKe00OXALWjSq4BOpRIFRVIVOusJG';

export function createAuthService(database: AppDatabase): AuthService {
  return {
    async verifyCredentials(email, password) {
      const user = await database.queryOne<StoredUser>(`
        SELECT id, email, name, role, password_hash
        FROM users
        WHERE email = $1 AND role = 'admin'
      `, [email]);

      const hashToCompare = user ? user.password_hash : DUMMY_HASH;
      const isValid = bcrypt.compareSync(password, hashToCompare);

      if (!user || !isValid) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: 'admin',
      };
    },

    async createSession(userId) {
      const session: Session = {
        id: randomUUID(),
        user_id: userId,
        expires_at: Date.now() + SESSION_TTL_MS,
        created_at: Date.now(),
      };
      await database.execute(`
        INSERT INTO sessions (id, user_id, expires_at, created_at)
        VALUES ($1, $2, $3, $4)
      `, [session.id, session.user_id, session.expires_at, session.created_at]);
      return session;
    },

    async getUserFromSession(sessionId) {
      const row = await database.queryOne<AuthUser>(`
        SELECT u.id, u.email, u.name, u.role
        FROM sessions s
        INNER JOIN users u ON u.id = s.user_id
        WHERE s.id = $1 AND s.expires_at > $2 AND u.role = 'admin'
      `, [sessionId, Date.now()]);

      if (!row) {
        return null;
      }

      return { ...row, role: 'admin' };
    },

    async deleteSession(sessionId) {
      await database.execute('DELETE FROM sessions WHERE id = $1', [sessionId]);
    },

    async deleteExpiredSessions() {
      await database.execute('DELETE FROM sessions WHERE expires_at <= $1', [Date.now()]);
    },

    async deleteAllAdminSessions() {
      const result = await database.execute(`
        DELETE FROM sessions
        WHERE user_id IN (
          SELECT id FROM users WHERE role = $1
        )
      `, ['admin']);
      return result.rowCount;
    },
  };
}
