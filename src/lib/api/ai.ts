import { request, ApiError } from './client';

export interface AiStatus {
  configured: boolean;
  model: string;
  provider: string;
  streamingSupported: boolean;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ValidatedToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  requiresConfirmation: boolean;
  valid: boolean;
  error?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ChatOptions {
  temperature?: number;
  max_tokens?: number;
  tools_enabled?: boolean;
}

function resolveApiUrl(path: string): string {
  const base = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '');
  return base ? `${base}${path}` : path;
}

export function sanitizeChatMessages(messages: ChatMessage[]): ChatMessage[] {
  if (!Array.isArray(messages)) return [];
  const result: ChatMessage[] = [];

  for (const m of messages) {
    if (!m) continue;
    if (m.role === 'tool') {
      if (typeof m.content === 'string' && m.content.trim().length > 0 && m.tool_call_id) {
        result.push({
          role: 'tool',
          tool_call_id: m.tool_call_id,
          content: m.content.trim(),
        });
      }
    } else if (m.role === 'assistant') {
      const hasContent = typeof m.content === 'string' && m.content.trim().length > 0;
      const hasTools = Array.isArray(m.tool_calls) && m.tool_calls.length > 0;
      if (hasContent || hasTools) {
        result.push({
          role: 'assistant',
          content: hasContent ? m.content!.trim() : undefined,
          tool_calls: hasTools ? m.tool_calls : undefined,
        });
      }
    } else if (m.role === 'user' || m.role === 'system') {
      if (typeof m.content === 'string' && m.content.trim().length > 0) {
        result.push({
          role: m.role,
          content: m.content.trim(),
        });
      }
    }
  }

  return result;
}

export const aiApi = {
  getStatus: () => request<AiStatus>('/api/ai/status'),

  sendNonStreaming: (messages: ChatMessage[], options: ChatOptions = {}, signal?: AbortSignal) => {
    const sanitized = sanitizeChatMessages(messages);
    if (sanitized.length === 0) {
      throw new ApiError('Cannot send chat request with empty messages.', 400, 'VALIDATION_ERROR');
    }
    return request<{ content: string; model: string }>('/api/ai/chat', {
      method: 'POST',
      body: { messages: sanitized, stream: false, ...options },
      signal,
    });
  },

  streamChat: async (
    messages: ChatMessage[],
    options: ChatOptions = {},
    onChunk: (chunk: string) => void,
    onToolCall?: (toolCall: ValidatedToolCall) => void,
    signal?: AbortSignal
  ): Promise<void> => {
    const sanitized = sanitizeChatMessages(messages);
    if (sanitized.length === 0) {
      throw new ApiError('Cannot send chat request with empty messages.', 400, 'VALIDATION_ERROR');
    }

    const url = resolveApiUrl('/api/ai/chat');
    let response: Response;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        credentials: 'include',
        body: JSON.stringify({ messages: sanitized, stream: true, ...options }),
        signal,
      });
    } catch (err: unknown) {
      if (signal?.aborted) return;
      const msg = err instanceof Error ? err.message : 'Network error';
      throw new ApiError(`Connection failed: ${msg}`, 0, 'NETWORK_ERROR');
    }

    if (!response.ok) {
      if (response.status === 503) {
        throw new ApiError(
          'NVIDIA NIM API key is not configured on the server. Please add NVIDIA_API_KEY in server environment.',
          503,
          'CONFIG_MISSING'
        );
      }
      if (response.status === 429) {
        throw new ApiError('AI rate limit reached. Please wait a moment before trying again.', 429, 'RATE_LIMITED');
      }

      let errorMsg = `AI service returned error (${response.status})`;
      try {
        const errorBody = (await response.json()) as { error?: string };
        if (errorBody && typeof errorBody.error === 'string') {
          errorMsg = errorBody.error;
        }
      } catch {
        // Fall back to default error message
      }

      throw new ApiError(errorMsg, response.status, 'HTTP_ERROR');
    }

    if (!response.body) {
      throw new ApiError('No response stream received from server.', 500, 'STREAM_EMPTY');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let totalChunksEmitted = 0;
    let totalToolCallsEmitted = 0;

    try {
      while (true) {
        if (signal?.aborted) {
          await reader.cancel();
          return;
        }

        const { done, value } = await reader.read();
        if (done) {
          // Flush decoder and any remaining buffered line
          buffer += decoder.decode();
          if (buffer.trim()) {
            const finalLines = buffer.split(/\r?\n/);
            for (const finalLine of finalLines) {
              const trimmed = finalLine.trim();
              if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
                const jsonStr = trimmed.slice(6).trim();
                if (jsonStr) {
                  try {
                    const data = JSON.parse(jsonStr) as {
                      chunk?: string;
                      tool_call?: ValidatedToolCall;
                      error?: string | { message?: string };
                      code?: string;
                    };
                    if (data.error) {
                      const errMsg =
                        typeof data.error === 'string'
                          ? data.error
                          : data.error.message || 'AI provider error';
                      throw new ApiError(errMsg, 502, data.code || 'PROVIDER_ERROR');
                    }
                    if (data.tool_call) {
                      totalToolCallsEmitted++;
                      onToolCall?.(data.tool_call);
                    }
                    if (typeof data.chunk === 'string' && data.chunk.length > 0) {
                      totalChunksEmitted++;
                      onChunk(data.chunk);
                    }
                  } catch (e) {
                    if (e instanceof ApiError) throw e;
                  }
                }
              }
            }
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;

          if (trimmed === 'data: [DONE]') {
            if (!signal?.aborted && totalChunksEmitted === 0 && totalToolCallsEmitted === 0) {
              throw new ApiError(
                'AI provider completed the stream without generating response tokens. Please try regenerating.',
                502,
                'EMPTY_STREAM'
              );
            }
            return;
          }

          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const data = JSON.parse(jsonStr) as {
                chunk?: string;
                tool_call?: ValidatedToolCall;
                error?: string | { message?: string };
                code?: string;
              };

              if (data.error) {
                const errMsg =
                  typeof data.error === 'string'
                    ? data.error
                    : data.error.message || 'AI provider error during inference';
                throw new ApiError(errMsg, 502, data.code || 'PROVIDER_ERROR');
              }

              if (data.tool_call) {
                totalToolCallsEmitted++;
                onToolCall?.(data.tool_call);
              }

              if (typeof data.chunk === 'string' && data.chunk.length > 0) {
                totalChunksEmitted++;
                onChunk(data.chunk);
              }
            } catch (parseErr) {
              if (parseErr instanceof ApiError) throw parseErr;
              // Ignore non-fatal intermediate stream fragments
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (!signal?.aborted && totalChunksEmitted === 0 && totalToolCallsEmitted === 0) {
      throw new ApiError(
        'AI provider completed the stream without generating response tokens. Please try regenerating.',
        502,
        'EMPTY_STREAM'
      );
    }
  },
};
