import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getTestDb } from './setup.js';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const testDb = getTestDb();

describe('Authentication', () => {
  beforeEach(() => {
    // Clear sessions
    testDb.prepare('DELETE FROM sessions').run();
  });

  describe('verifyCredentials', () => {
    it('should return user for valid credentials', () => {
      const { verifyCredentials } = await import('../services/auth.js');
      const user = verifyCredentials('admin@mimios.local', 'mimiisbest@1@');
      expect(user).toBeTruthy();
      expect(user?.email).toBe('admin@mimios.local');
      expect(user?.role).toBe('admin');
    });

    it('should return null for invalid password', () => {
      const { verifyCredentials } = await import('../services/auth.js');
      const user = verifyCredentials('admin@mimios.local', 'wrongpassword');
      expect(user).toBeNull();
    });

    it('should return null for non-existent user', () => {
      const { verifyCredentials } = await import('../services/auth.js');
      const user = verifyCredentials('nonexistent@test.com', 'password');
      expect(user).toBeNull();
    });
  });

  describe('Session management', () => {
    it('should create and validate session', async () => {
      const { createSession, getUserFromSession, clearAdminAuth } = await import('../services/auth.js');
      const { clearAdminAuth } = await import('../services/auth.js');

      // Clear any existing auth
      clearAdminAuth();

      const userId = 'test-user-id';
      const sessionId = createSession(userId);

      expect(sessionId).toBeTruthy();

      const session = getUserFromSession(sessionId);
      expect(session).toBeTruthy();
      expect(session?.user?.id).toBe('test-user-id');
    });

    it('should invalidate session on logout', () => {
      const { createSession, getUserFromSession, clearAdminAuth } = await import('../services/auth.js');

      const userId = 'test-user-id-2';
      const sessionId = createSession(userId);

      let session = getUserFromSession(sessionId);
      expect(session).toBeTruthy();

      clearAdminAuth();

      session = getUserFromSession(sessionId);
      expect(session).toBeNull();
    });

    it('should reject invalid session', () => {
      const { getUserFromSession } = await import('../services/auth.js');

      const session = getUserFromSession('invalid-session-id');
      expect(session).toBeNull();
    });
  });

  describe('Password hashing', () => {
    it('should hash and verify passwords correctly', () => {
      const password = 'test-password-123';
      const hash = bcrypt.hashSync(password, 12);

      expect(bcrypt.compareSync(password, hash)).toBe(true);
      expect(bcrypt.compareSync('wrong-password', hash)).toBe(false);
    });
  });
});