import type { FastifyInstance } from 'fastify';
import { validateBody } from '../middleware/validation.js';
import { aiChatRequestSchema } from '../schemas/index.js';
import {
  getAiStatus,
  streamAiChat,
  sendAiChat,
  AiProviderError,
  type ChatMessage,
} from '../services/ai.js';
import type { RouteContext } from './context.js';

export async function aiRoutes(fastify: FastifyInstance, context: RouteContext): Promise<void> {
  // GET /api/ai/status - Returns provider readiness, model name, and capability (never secrets)
  fastify.get('/status', async () => {
    return {
      success: true,
      data: getAiStatus(context.config),
    };
  });

  // POST /api/ai/chat - Communicates with NVIDIA NIM for cybersecurity and project assistance
  fastify.post(
    '/chat',
    {
      preValidation: [validateBody(aiChatRequestSchema)],
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const { messages, stream = true, temperature, max_tokens, tools_enabled = true } = request.body as {
        messages: ChatMessage[];
        stream?: boolean;
        temperature?: number;
        max_tokens?: number;
        tools_enabled?: boolean;
      };

      const reqId = request.id;
      const startTime = Date.now();
      request.log.info(
        { reqId, model: context.config.NVIDIA_NIM_MODEL, messageCount: messages.length, stream },
        'AI chat request initiated'
      );

      const abortController = new AbortController();
      request.raw.on('close', () => {
        if (!reply.raw.writableEnded) {
          abortController.abort();
        }
      });
      reply.raw.on('close', () => {
        if (!reply.raw.writableEnded) {
          abortController.abort();
        }
      });

      if (!stream) {
        try {
          const result = await sendAiChat(
            messages,
            { temperature, max_tokens, tools_enabled },
            context.config,
            abortController.signal
          );
          request.log.info(
            { reqId, elapsedMs: Date.now() - startTime, status: 200, completed: true },
            'Non-streaming AI chat request completed successfully'
          );
          return { success: true, data: result };
        } catch (err: unknown) {
          if (err instanceof AiProviderError) {
            request.log.warn(
              { reqId, elapsedMs: Date.now() - startTime, statusCode: err.statusCode, code: err.code, error: err.message },
              'Non-streaming AI chat provider error'
            );
            return reply.status(err.statusCode).send({
              success: false,
              error: err.message,
              code: err.code,
            });
          }
          request.log.error(
            { reqId, elapsedMs: Date.now() - startTime, err },
            'Non-streaming AI chat request failed unexpectedly'
          );
          return reply.status(502).send({
            success: false,
            error: 'Failed to communicate with AI inference provider',
            code: 'PROVIDER_ERROR',
          });
        }
      }

      // Streaming Server-Sent Events (SSE) mode
      reply.raw.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('X-Accel-Buffering', 'no');

      // Send initial keepalive comment to open stream
      reply.raw.write(': mimi-ai-stream-start\n\n');

      let chunksWritten = 0;

      try {
        await streamAiChat(
          messages,
          { temperature, max_tokens, tools_enabled },
          context.config,
          (chunk) => {
            chunksWritten++;
            if (!reply.raw.writableEnded && !abortController.signal.aborted) {
              reply.raw.write(`data: ${JSON.stringify({ chunk })}\n\n`);
            }
          },
          (toolCall) => {
            chunksWritten++;
            if (!reply.raw.writableEnded && !abortController.signal.aborted) {
              reply.raw.write(`data: ${JSON.stringify({ tool_call: toolCall })}\n\n`);
            }
          },
          abortController.signal
        );

        if (!reply.raw.writableEnded) {
          if (chunksWritten === 0 && !abortController.signal.aborted) {
            request.log.warn(
              { reqId, elapsedMs: Date.now() - startTime, chunksDelivered: 0 },
              'AI stream finished with 0 content chunks delivered'
            );
            reply.raw.write(
              `data: ${JSON.stringify({
                error: 'AI provider completed the stream without generating response tokens.',
                code: 'EMPTY_STREAM',
              })}\n\n`
            );
          } else {
            request.log.info(
              { reqId, elapsedMs: Date.now() - startTime, chunksDelivered: chunksWritten, status: 200, completed: true },
              'AI chat stream completed successfully'
            );
          }
          reply.raw.write('data: [DONE]\n\n');
          reply.raw.end();
        }
      } catch (err: unknown) {
        if (abortController.signal.aborted) {
          request.log.info(
            { reqId, elapsedMs: Date.now() - startTime, cancelled: true },
            'AI chat stream cancelled by client'
          );
          if (!reply.raw.writableEnded) {
            reply.raw.end();
          }
          return;
        }

        const message = err instanceof Error ? err.message : 'AI inference failed';
        const code = err instanceof AiProviderError ? err.code : 'PROVIDER_ERROR';
        const statusCode = err instanceof AiProviderError ? err.statusCode : 502;

        request.log.error(
          { reqId, elapsedMs: Date.now() - startTime, chunksDelivered: chunksWritten, statusCode, code, error: message },
          'AI chat stream failed'
        );

        if (!reply.raw.writableEnded) {
          reply.raw.write(`data: ${JSON.stringify({ error: message, code })}\n\n`);
          reply.raw.write('data: [DONE]\n\n');
          reply.raw.end();
        }
      }
    }
  );
}
