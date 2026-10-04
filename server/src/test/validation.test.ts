import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.js';

describe('Validation Middleware', () => {
  const testSchema = z.object({
    name: z.string().min(1).max(100),
    email: z.string().email(),
    age: z.number().int().min(0).max(150),
    tags: z.array(z.string()).optional()
  });

  describe('validateBody', () => {
    it('should pass valid data', async () => {
      const request = { body: { name: 'John', email: 'john@test.com', age: 30 } };
      const reply: any = { status: vi.fn().mockReturnThis(), send: vi.fn() };

      const middleware = validateBody(z.object({
        name: z.string().min(1),
        email: z.string().email(),
        age: z.number().int().min(0).max(150)
      }));

      await validateBody(testSchema)({ body: { name: 'John', email: 'john@test.com', age: 30 } } as any, reply);

      expect(reply.status).not.toHaveBeenCalled();
    });

    it('should reject invalid email', async () => {
      const reply: any = { status: vi.fn().mockReturnThis(), send: vi.fn() };

      await validateBody(z.object({
        email: z.string().email()
      }))({ body: { email: 'invalid-email' } } as any, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        code: 'VALIDATION_ERROR'
      }));
    });

    it('should reject missing required fields', async () => {
      const reply: any = { status: vi.fn().mockReturnThis(), send: vi.fn() };

      await validateBody(z.object({
        name: z.string().min(1),
        email: z.string().email()
      }))({ body: {} } as any, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });
  });

  describe('validateQuery', () => {
    it('should validate query parameters', async () => {
      const reply: any = { status: vi.fn().mockReturnThis(), send: vi.fn() };

      await validateQuery(z.object({
        page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive()),
        limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive().max(100)).optional()
      }))({ query: { page: '1', limit: '10' } } as any, reply);

      expect(reply.status).not.toHaveBeenCalled();
    });

    it('should reject invalid page parameter', async () => {
      const reply: any = { status: vi.fn().mockReturnThis(), send: vi.fn() };

      await validateQuery(z.object({
        page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive())
      }))({ query: { page: 'abc' } } as any, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });
  });

  describe('validateParams', () => {
    it('should validate UUID params', async () => {
      const reply: any = { status: vi.fn().mockReturnThis(), send: vi.fn() };

      await validateParams(z.object({
        id: z.string().uuid()
      }))({ params: { id: '550e8400-e29b-41d4-a716-446655440000' } } as any, reply);

      expect(reply.status).not.toHaveBeenCalled();
    });

    it('should reject invalid UUID', async () => {
      const reply: any = { status: vi.fn().mockReturnThis(), send: vi.fn() };

      await validateParams(z.object({
        id: z.string().uuid()
      }))({ params: { id: 'not-a-uuid' } } as any, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });
  });
});