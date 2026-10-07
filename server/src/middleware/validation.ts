import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

function validationResponse(error: z.ZodError): {
  success: false;
  error: string;
  code: string;
  details: Array<{ field: string; message: string; code: string }>;
} {
  return {
    success: false,
    error: 'Validation failed',
    code: 'VALIDATION_ERROR',
    details: error.issues.map((issue) => ({
      field: issue.path.join('.') || 'request',
      message: issue.message,
      code: issue.code,
    })),
  };
}

function validate(schema: z.ZodTypeAny, value: unknown, request: FastifyRequest, field: 'body' | 'query' | 'params'): unknown {
  const parsed = schema.parse(value);
  (request as FastifyRequest & Record<string, unknown>)[field] = parsed;
  return parsed;
}

export function validateBody(schema: z.ZodTypeAny) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      validate(schema, request.body, request, 'body');
    } catch (error) {
      if (error instanceof z.ZodError) {
        await reply.status(400).send(validationResponse(error));
        return;
      }
      throw error;
    }
  };
}

export function validateQuery(schema: z.ZodTypeAny) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      validate(schema, request.query, request, 'query');
    } catch (error) {
      if (error instanceof z.ZodError) {
        await reply.status(400).send(validationResponse(error));
        return;
      }
      throw error;
    }
  };
}

export function validateParams(schema: z.ZodTypeAny) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      validate(schema, request.params, request, 'params');
    } catch (error) {
      if (error instanceof z.ZodError) {
        await reply.status(400).send(validationResponse(error));
        return;
      }
      throw error;
    }
  };
}
