import { db } from '../db/index.js';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import type { AuthUser, Session, User } from '../types/index.js';

const SESSION_COOKIE_NAME = 'mimios_session';
const SESSION_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days

export function createSession(userId: string): Session {
  const sessionId = randomUUID();
  const expiresAt = Date.now() + SESSION_TTL;
  const now = Date.now();

  const session: Session = {
    id: sessionId,
    user_id: userId,
    expires_at: now + SESSION_TTL,
    created_at: Date.now(),
  };

  db.prepare('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(session.id, session.user_id, session.expires_at, session.created_at);

  return session;
}

export function getSession(sessionId: string): Session | null {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ? AND expires_at > ?')
    .get(sessionId, Date.now());
  return session || null;
}

export function deleteSession(sessionId: string): void {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

export function deleteUserSessions(userId: string): void {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

export function getUserFromSession(sessionId: string): { user: { id: string; email: string; name: string; role: string } } | null {
  const session = getSession(sessionId);
  if (!session) return null;

  const user = db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(session.user_id) as { id: string; email: string; name: string; role: string } | undefined;
  return user ? { id: user.id, email: user.email, name: user.name, role: user.role } : null;
}

export function verifyCredentials(email: string, password: string): { user: { id: string; email: string; name: string; role: string } } | null {
  const user = db.prepare('SELECT id, email, password_hash, name, role FROM users WHERE email = ?').get(email) as
    | { id: string; email: string; password_hash: string; name: string; role: string }
    | undefined;

  if (!user) return null;

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return null;

  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export function createAuthCookie(sessionId: string): string {
  const isProduction = process.env.NODE_ENV === 'production';
  return `${SESSION_COOKIE_NAME}=${sessionId}; HttpOnly; Path=/; Max-Age=${SESSION_TTL / 1000}; SameSite=Lax${isProduction ? '; Secure' : ''}`;
}

export function clearAuthCookie(): string {
  const isProduction = process.env.NODE_ENV === 'production';
  return `${SESSION_COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${isProduction ? '; Secure' : ''}`;
}

export function getSessionFromCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map(c => c.trim());
  for (const cookie of cookies) {
    const [name, value] = cookie.split('=');
    if (name === 'mimios_session') return value;
  }
  return null;
}