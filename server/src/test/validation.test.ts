import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.js';

function replyMock() {
  return { status: vi.fn().mockReturnThis(), send: vi.fn() };
}

describe('validation middleware', () => {
  it('accepts and writes a valid body', async () => {
    const request = { body: { name: 'MimiOS' } } as never;
    const reply = replyMock();
    await validateBody(z.object({ name: z.string().min(1) }))(request, reply as never);
    expect(reply.status).not.toHaveBeenCalled();
    expect((request as { body: { name: string } }).body.name).toBe('MimiOS');
  });

  it('rejects unexpected body fields and malformed IDs', async () => {
    const reply = replyMock();
    await validateBody(z.object({ name: z.string() }).strict())({ body: { name: 'x', extra: true } } as never, reply as never);
    expect(reply.status).toHaveBeenCalledWith(400);

    const paramsReply = replyMock();
    await validateParams(z.object({ id: z.string().uuid() }))({ params: { id: '../etc/passwd' } } as never, paramsReply as never);
    expect(paramsReply.status).toHaveBeenCalledWith(400);
  });

  it('supports transformed query values', async () => {
    const request = { query: { limit: '10' } } as never;
    const reply = replyMock();
    await validateQuery(z.object({ limit: z.string().transform(Number) }))(request, reply as never);
    expect((request as { query: { limit: number } }).query.limit).toBe(10);
  });
});
