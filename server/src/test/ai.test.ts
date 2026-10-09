import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { closeDatabase, initializeDatabase } from '../db/index.js';
import { loadTestConfig } from './test-app.js';
import { MIMI_AI_SYSTEM_PROMPT } from '../services/ai.js';

describe('MimiAI & NVIDIA NIM Provider Adapter', () => {
  let app: FastifyInstance;
  let config = loadTestConfig();
  let db: Awaited<ReturnType<typeof initializeDatabase>>;

  beforeAll(async () => {
    db = await initializeDatabase(config);
    app = await buildApp({ database: db, config });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await closeDatabase(db);
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/ai/status', () => {
    it('returns provider status without exposing credentials when key is not configured', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/ai/status',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.configured).toBe(false);
      expect(body.data.model).toBe('meta/llama-3.1-70b-instruct');
      expect(body.data.provider).toBe('NVIDIA NIM');
      expect(body.data.streamingSupported).toBe(true);
      // Ensure no key is ever in payload
      expect(JSON.stringify(body).includes('key')).toBe(false);
    });

    it('returns configured: true when NVIDIA_API_KEY is present', async () => {
      const configWithKey = { ...config, NVIDIA_API_KEY: 'nvapi-test-key-12345' };
      const testApp = await buildApp({ database: db, config: configWithKey });
      await testApp.ready();

      const res = await testApp.inject({
        method: 'GET',
        url: '/api/ai/status',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.configured).toBe(true);
      expect(JSON.stringify(body).includes('nvapi-test-key-12345')).toBe(false);

      await testApp.close();
    });
  });

  describe('POST /api/ai/chat Validation & Safety', () => {
    it('rejects empty message array with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/ai/chat',
        payload: { messages: [] },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('VALIDATION_ERROR');
    });

    it('rejects messages with invalid roles with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/ai/chat',
        payload: {
          messages: [{ role: 'hacker', content: 'test message' }],
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('VALIDATION_ERROR');
    });

    it('rejects messages with empty content with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/ai/chat',
        payload: {
          messages: [{ role: 'user', content: '   ' }],
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('VALIDATION_ERROR');
    });

    it('regression: rejects multi-message request when messages[1].content is empty string with 400 and too_small', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/ai/chat',
        payload: {
          messages: [
            { role: 'user', content: 'What is nmap?' },
            { role: 'assistant', content: '' },
            { role: 'user', content: 'Tell me about flags' },
          ],
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'messages.1.content',
            code: 'too_small',
          }),
        ])
      );
    });

    it('regression: rejects multi-message request when messages[1].content is whitespace only', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/ai/chat',
        payload: {
          messages: [
            { role: 'user', content: 'What is nmap?' },
            { role: 'assistant', content: '   ' },
          ],
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'messages.1.content',
            code: 'too_small',
          }),
        ])
      );
    });

    it('accepts valid multi-message conversation with non-empty content', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/ai/chat',
        payload: {
          messages: [
            { role: 'user', content: 'Hello MimiAI' },
            { role: 'assistant', content: 'Hello! I am your defensive security companion.' },
            { role: 'user', content: 'Explain SYN scan techniques' },
          ],
          stream: false,
        },
      });

      // Passes validation; reaches route handler (503 CONFIG_MISSING because key is not configured in this test instance)
      expect(res.statusCode).toBe(503);
      expect(res.json().code).toBe('CONFIG_MISSING');
    });

    it('returns 503 CONFIG_MISSING when NVIDIA_API_KEY is not configured', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/ai/chat',
        payload: {
          messages: [{ role: 'user', content: 'Hello MimiAI' }],
          stream: false,
        },
      });

      expect(res.statusCode).toBe(503);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.code).toBe('CONFIG_MISSING');
      expect(body.error).toContain('NVIDIA NIM API key is not configured');
    });
  });

  describe('NVIDIA NIM Inference Flow', () => {
    let configuredApp: FastifyInstance;
    const testApiKey = 'nvapi-mock-secret-key-999';

    beforeAll(async () => {
      const configWithKey = {
        ...config,
        NVIDIA_API_KEY: testApiKey,
        NVIDIA_NIM_MODEL: 'meta/llama-3.1-70b-instruct',
      };
      configuredApp = await buildApp({ database: db, config: configWithKey });
      await configuredApp.ready();
    });

    afterAll(async () => {
      await configuredApp.close();
    });

    it('successfully streams assistant tokens via Server-Sent Events', async () => {
      let capturedHeaders: Record<string, string> | undefined;
      let capturedBody: string | undefined;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input: unknown, init?: RequestInit) => {
        capturedHeaders = init?.headers as Record<string, string> | undefined;
        capturedBody = init?.body as string | undefined;

        // Mock SSE streaming response from NVIDIA NIM
        const sseStream = new ReadableStream({
          start(controller) {
            const chunks = [
              'data: {"id":"chat-1","choices":[{"index":0,"delta":{"content":"*Purrs* Greetings, "},"finish_reason":null}]}\n\n',
              'data: {"id":"chat-1","choices":[{"index":0,"delta":{"content":"operator. "},"finish_reason":null}]}\n\n',
              'data: {"id":"chat-1","choices":[{"index":0,"delta":{"content":"All systems stealthy."},"finish_reason":null}]}\n\n',
              'data: [DONE]\n\n',
            ];
            for (const chunk of chunks) {
              controller.enqueue(new TextEncoder().encode(chunk));
            }
            controller.close();
          },
        });

        return new Response(sseStream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      });

      const res = await configuredApp.inject({
        method: 'POST',
        url: '/api/ai/chat',
        payload: {
          messages: [{ role: 'user', content: 'What is your status, Mimi?' }],
          stream: true,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/event-stream');
      const payload = res.payload;
      expect(payload).toContain('data: {"chunk":"*Purrs* Greetings, "}');
      expect(payload).toContain('data: {"chunk":"operator. "}');
      expect(payload).toContain('data: {"chunk":"All systems stealthy."}');
      expect(payload).toContain('data: [DONE]');

      // Verify Authorization header used Bearer token
      expect(capturedHeaders?.['Authorization']).toBe(`Bearer ${testApiKey}`);

      // Verify System prompt was injected in the request body
      const parsedBody = JSON.parse(capturedBody!);
      expect(parsedBody.messages[0].role).toBe('system');
      expect(parsedBody.messages[0].content).toBe(MIMI_AI_SYSTEM_PROMPT);
      expect(parsedBody.messages[1].content).toBe('What is your status, Mimi?');

      // Verify secret token is NOT leaked in response
      expect(payload.includes(testApiKey)).toBe(false);
    });

    it('successfully processes non-streaming request when stream=false', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        const sseStream = new ReadableStream({
          start(controller) {
            const chunks = [
              'data: {"choices":[{"delta":{"content":"Stealth mode engaged."}}]}\n\n',
              'data: [DONE]\n\n',
            ];
            for (const chunk of chunks) {
              controller.enqueue(new TextEncoder().encode(chunk));
            }
            controller.close();
          },
        });

        return new Response(sseStream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      });

      const res = await configuredApp.inject({
        method: 'POST',
        url: '/api/ai/chat',
        payload: {
          messages: [{ role: 'user', content: 'Report status' }],
          stream: false,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.content).toBe('Stealth mode engaged.');
      expect(body.data.model).toBe('meta/llama-3.1-70b-instruct');
    });

    it('handles upstream rate limits (429) gracefully without 500 error', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const res = await configuredApp.inject({
        method: 'POST',
        url: '/api/ai/chat',
        payload: {
          messages: [{ role: 'user', content: 'High frequency question' }],
          stream: false,
        },
      });

      expect(res.statusCode).toBe(429);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.code).toBe('RATE_LIMITED');
    });

    it('handles unavailable model (404) gracefully', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return new Response(JSON.stringify({ error: 'Model not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const res = await configuredApp.inject({
        method: 'POST',
        url: '/api/ai/chat',
        payload: {
          messages: [{ role: 'user', content: 'Testing model' }],
          stream: false,
        },
      });

      expect(res.statusCode).toBe(502);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.code).toBe('MODEL_UNAVAILABLE');
    });

    it('recovers from transient in-stream ResourceExhausted worker error on retry', async () => {
      let callCount = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // Attempt 1: In-stream error frame from overloaded worker
          const errorStream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                new TextEncoder().encode(
                  'data: {"error":{"message":"ResourceExhausted: Worker local total request limit reached (16/16)","type":"internal_server_error","code":500}}\n\ndata: [DONE]\n\n'
                )
              );
              controller.close();
            },
          });
          return new Response(errorStream, {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          });
        }

        // Attempt 2: Succeeds
        const successStream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                'data: {"choices":[{"delta":{"content":"Successfully recovered after retry."}}]}\n\ndata: [DONE]\n\n'
              )
            );
            controller.close();
          },
        });
        return new Response(successStream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      });

      const res = await configuredApp.inject({
        method: 'POST',
        url: '/api/ai/chat',
        payload: {
          messages: [{ role: 'user', content: 'Test retry behavior' }],
          stream: true,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(callCount).toBe(2);
      expect(res.payload).toContain('data: {"chunk":"Successfully recovered after retry."}');
      expect(res.payload).toContain('data: [DONE]');
    });

    it('emits RATE_LIMITED error frame if in-stream ResourceExhausted persists across retries', async () => {
      let callCount = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        callCount++;
        const errorStream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                'data: {"error":{"message":"ResourceExhausted: Worker local total request limit reached (16/16)"}}\n\ndata: [DONE]\n\n'
              )
            );
            controller.close();
          },
        });
        return new Response(errorStream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      });

      const res = await configuredApp.inject({
        method: 'POST',
        url: '/api/ai/chat',
        payload: {
          messages: [{ role: 'user', content: 'Persistent overload test' }],
          stream: true,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(callCount).toBe(3); // Attempt 0 + 2 retries
      expect(res.payload).toContain('"code":"RATE_LIMITED"');
      expect(res.payload).toContain('ResourceExhausted');
    });

    it('emits EMPTY_STREAM error frame when upstream delivers 0 tokens and completes', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        const emptyStream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
            controller.close();
          },
        });
        return new Response(emptyStream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      });

      const res = await configuredApp.inject({
        method: 'POST',
        url: '/api/ai/chat',
        payload: {
          messages: [{ role: 'user', content: 'Empty stream test' }],
          stream: true,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.payload).toContain('"code":"EMPTY_STREAM"');
      expect(res.payload).toContain('AI provider completed the stream without generating response tokens.');
      expect(res.payload).toContain('data: [DONE]');
    });

    it('correctly handles split chunks fragmented across stream network boundaries', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        const stream = new ReadableStream({
          start(controller) {
            // Fragmented chunks split in mid-json across byte boundaries
            controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"con'));
            controller.enqueue(new TextEncoder().encode('tent":"Part1 and "}}]}\n\n'));
            controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Part2"}}]}\n\ndata: [DONE]\n\n'));
            controller.close();
          },
        });
        return new Response(stream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      });

      const res = await configuredApp.inject({
        method: 'POST',
        url: '/api/ai/chat',
        payload: {
          messages: [{ role: 'user', content: 'Fragmented chunk test' }],
          stream: true,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.payload).toContain('data: {"chunk":"Part1 and "}');
      expect(res.payload).toContain('data: {"chunk":"Part2"}');
      expect(res.payload).toContain('data: [DONE]');
    });

    it('falls back to reasoning_content when content delta is empty', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                'data: {"choices":[{"delta":{"reasoning_content":"Step 1: Check security logs."}}]}\n\ndata: [DONE]\n\n'
              )
            );
            controller.close();
          },
        });
        return new Response(stream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      });

      const res = await configuredApp.inject({
        method: 'POST',
        url: '/api/ai/chat',
        payload: {
          messages: [{ role: 'user', content: 'Reasoning test' }],
          stream: true,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.payload).toContain('data: {"chunk":"Step 1: Check security logs."}');
      expect(res.payload).toContain('data: [DONE]');
    });
  });
});
