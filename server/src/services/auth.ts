import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { AppDatabase } from '../db/index.js';
import type { AuthUser, Session } from '../types/index.js';

export const SESSION_COOKIE_NAME = 'mimios_session';
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

type StoredUser = AuthUser & { password_hash: string };

export interface AuthService {
  verifyCredentials(email: string, password: string): AuthUser | null;
  createSession(userId: string): Session;
  getUserFromSession(sessionId: string): AuthUser | null;
  deleteSession(sessionId: string): void;
  deleteExpiredSessions(): void;
}

// Constant-time dummy hash to prevent email enumeration via timing side-channels
const DUMMY_HASH = '$2a$12$lHjbCXof903VQtVBoQVtgOxLjKe00OXALWjSq4BOpRIFRVIVOusJG';

export function createAuthService(database: AppDatabase): AuthService {
  return {
    verifyCredentials(email, password) {
      const user = database.prepare(`
        SELECT id, email, name, role, password_hash
        FROM users
        WHERE email = ? AND role = 'admin'
      `).get(email) as StoredUser | undefined;

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

    createSession(userId) {
      const session: Session = {
        id: randomUUID(),
        user_id: userId,
        expires_at: Date.now() + SESSION_TTL_MS,
        created_at: Date.now(),
      };
      database.prepare(`
        INSERT INTO sessions (id, user_id, expires_at, created_at)
        VALUES (?, ?, ?, ?)
      `).run(session.id, session.user_id, session.expires_at, session.created_at);
      return session;
    },

    getUserFromSession(sessionId) {
      const row = database.prepare(`
        SELECT u.id, u.email, u.name, u.role
        FROM sessions s
        INNER JOIN users u ON u.id = s.user_id
        WHERE s.id = ? AND s.expires_at > ? AND u.role = 'admin'
      `).get(sessionId, Date.now()) as AuthUser | undefined;

      if (!row) {
        return null;
      }

      return { ...row, role: 'admin' };
    },

    deleteSession(sessionId) {
      database.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    },

    deleteExpiredSessions() {
      database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
    },
  };
}
