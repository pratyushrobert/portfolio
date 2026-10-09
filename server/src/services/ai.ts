import type { RuntimeConfig } from '../config/env.js';
import {
  MIMIOS_TOOL_DEFINITIONS,
  validateMimiOsToolCall,
  type ValidatedToolCall,
} from './ai-tools.js';

export {
  MIMIOS_TOOL_DEFINITIONS,
  validateMimiOsToolCall,
  type ValidatedToolCall,
};

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
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
  stream?: boolean;
  tools_enabled?: boolean;
}

export interface AiStatus {
  configured: boolean;
  model: string;
  provider: string;
  streamingSupported: boolean;
}

export type AiErrorCode =
  | 'CONFIG_MISSING'
  | 'AUTH_ERROR'
  | 'RATE_LIMITED'
  | 'MODEL_UNAVAILABLE'
  | 'PROVIDER_ERROR'
  | 'TIMEOUT'
  | 'NETWORK_ERROR';

export class AiProviderError extends Error {
  constructor(
    message: string,
    public readonly code: AiErrorCode,
    public readonly statusCode: number = 502
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}

export const MIMI_AI_SYSTEM_PROMPT = `You are MimiAI — The Cyber Ninja Cat, an AI-powered cybersecurity companion and project-development assistant living inside MimiOS.

# Persona and Character
- You are intelligent, curious, concise, and occasionally witty.
- Subtle feline & ninja traits: You observe stealthily, have sharp instincts, pounce on bugs, and value agile, clean solutions. Use light feline or ninja metaphors sparingly and tastefully (e.g., *paws at the log file*, *stealth code inspection*). Never be obnoxious or overly childish.
- You explain concepts clearly, intuitively, and systematically instead of simply dumping raw commands.
- You are strictly honest about your capabilities and limitations. Never fabricate tool results, network scans, or system states.

# Core Mission: Cybersecurity Companion
- Knowledge domains: Linux fundamentals, networking (TCP/IP, OSI, routing, packets), network reconnaissance (Nmap flags, discovery techniques), packet inspection (Wireshark filters, stream analysis), web application security (OWASP Top 10, XSS, SQLi, CSRF, SSRF, IDOR, authentication/session management), cryptography, and defensive system hardening.
- Strictly Defensive & Educational Posture: You exclusively promote defensive security, secure code design, threat modeling, and authorized testing. Never assist in unauthorized intrusions, real-world exploitation against unconsenting targets, or malicious payloads.
- Simulated Tools Awareness: In MimiOS, cyber tools in the terminal (such as nmap, scan, etc.) are educational simulations. Always remind the user that they are safe in-browser simulations, and never claim a real attack or external scan was executed.

# Core Mission: MimiOS Project Assistant & Restricted Desktop Interaction
- Architecture Awareness:
  - MimiOS is a browser-based portfolio operating system built with React 19, TypeScript, Zustand stores (useWindowStore, useDesktopStore), and Vite.
  - UI Engine: Multi-window desktop manager with movable, resizable, minimizable, maximizable windows, a 9-dot application launcher, top dock panel, and an advanced liquid-glass CSS engine (backdrop-filter: var(--glass-blur), neutral multi-stop translucent surfaces).
  - VirtualFS: In-browser virtual file system supporting Unix-like commands (ls, cd, cat, mkdir, cp, mv, rm, tree, stat, find).
  - Terminal: Modular command registry with support for built-in utilities and custom cyber/mascot commands.
  - Backend: Fastify server running on Node.js, backed by PostgreSQL via Supabase (connection pooler / direct connection), Supabase Storage for persistent media uploads, bcrypt password hashing, HttpOnly session cookies (SameSite=None in cross-origin production, Secure, signed with fastify-cookie), strict CORS and mutating CSRF protection.
- Restricted Desktop Actions:
  - You have access to restricted tools to interact with the MimiOS desktop:
    - open_app(appId): Launch an approved application (e.g. 'files', 'terminal', 'about', 'projects', 'skills', 'experience', 'certificates', 'resume', 'editor', 'settings', 'contact', 'snake').
    - close_app(appId): Close an open application window (pass "current" to close the companion window).
    - focus_app(appId): Bring a running application window to the foreground.
    - navigate_filesystem(path): Navigate the File Manager to a directory (e.g. '/home/pratyush/documents').
  - Security Rules:
    - Never attempt to open administrative applications ('admin-portal', 'admin-login').
    - Never attempt to access private or secret paths (e.g. '.secret').
    - Never execute arbitrary shell commands or code.
    - When a user asks to open or navigate, invoke the appropriate tool instead of only talking about it.
    - Once tool results are returned, explain the outcome naturally to the user.

# Response Guidelines
- Format code blocks with clear language identifiers (e.g. \`\`\`bash, \`\`\`typescript, \`\`\`json).
- Keep explanations structured, punchy, and actionable.
- If the user asks about an offensive technique, explain both the mechanics and the defensive remediation / mitigation strategy clearly.`;

export function getAiStatus(config: RuntimeConfig): AiStatus {
  const isKeyConfigured = Boolean(config.NVIDIA_API_KEY && config.NVIDIA_API_KEY.trim().length > 0);
  return {
    configured: isKeyConfigured,
    model: config.NVIDIA_NIM_MODEL || 'meta/llama-3.1-70b-instruct',
    provider: 'NVIDIA NIM',
    streamingSupported: true,
  };
}

export function buildInferenceMessages(messages: ChatMessage[]): Array<Record<string, unknown>> {
  // Enforce system prompt as first message
  const hasSystem = messages.some((m) => m.role === 'system');
  const normalized: Array<Record<string, unknown>> = [];

  if (!hasSystem) {
    normalized.push({ role: 'system', content: MIMI_AI_SYSTEM_PROMPT });
  }

  for (const m of messages) {
    if (m.role === 'system') {
      normalized.push({
        role: 'system',
        content: `${MIMI_AI_SYSTEM_PROMPT}\n\nAdditional Instructions:\n${m.content || ''}`,
      });
    } else if (m.role === 'tool') {
      normalized.push({
        role: 'tool',
        tool_call_id: m.tool_call_id || '',
        content: m.content || '',
      });
    } else if (m.role === 'assistant') {
      const msg: Record<string, unknown> = {
        role: 'assistant',
        content: m.content ?? null,
      };
      if (Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
        msg.tool_calls = m.tool_calls;
      }
      normalized.push(msg);
    } else {
      normalized.push({
        role: m.role,
        content: m.content || '',
      });
    }
  }

  return normalized;
}

export async function streamAiChat(
  messages: ChatMessage[],
  options: ChatOptions,
  config: RuntimeConfig,
  onChunk: (chunk: string) => void,
  onToolCall?: (toolCall: ValidatedToolCall) => void,
  signal?: AbortSignal
): Promise<void> {
  const apiKey = config.NVIDIA_API_KEY?.trim();
  if (!apiKey) {
    throw new AiProviderError(
      'NVIDIA NIM API key is not configured on the server. Please set NVIDIA_API_KEY in the server environment.',
      'CONFIG_MISSING',
      503
    );
  }

  const baseURL = config.NVIDIA_NIM_BASE_URL.replace(/\/+$/, '');
  const model = config.NVIDIA_NIM_MODEL || 'meta/llama-3.1-70b-instruct';
  const fullMessages = buildInferenceMessages(messages);

  const requestBody: Record<string, unknown> = {
    model,
    messages: fullMessages,
    temperature: typeof options.temperature === 'number' ? Math.max(0, Math.min(2, options.temperature)) : 0.6,
    max_tokens: typeof options.max_tokens === 'number' ? Math.max(1, Math.min(4096, options.max_tokens)) : 2048,
    stream: true,
  };

  if (options.tools_enabled !== false) {
    requestBody.tools = MIMIOS_TOOL_DEFINITIONS;
    requestBody.tool_choice = 'auto';
  }

  const MAX_TRANSIENT_RETRIES = 2; // Up to 2 retries on transient Worker ResourceExhausted before any chunk emitted
  let chunksEmitted = 0;

  for (let attempt = 0; attempt <= MAX_TRANSIENT_RETRIES; attempt++) {
    if (signal?.aborted) return;

    if (attempt > 0) {
      // Bounded backoff: wait ~1000ms for worker slot to free up
      const delayMs = 900 + Math.random() * 400;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      if (signal?.aborted) return;
    }

    let response: Response;
    try {
      const timeoutSignal = AbortSignal.timeout(60000);
      const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

      response = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(requestBody),
        signal: combinedSignal,
      });
    } catch (err: unknown) {
      if (signal?.aborted) return;
      const message = err instanceof Error ? err.message : 'Network request failed';
      if (message.toLowerCase().includes('timeout') || (err as { name?: string }).name === 'TimeoutError') {
        throw new AiProviderError('NVIDIA NIM request timed out after 60 seconds.', 'TIMEOUT', 504);
      }
      throw new AiProviderError(`Failed to connect to NVIDIA NIM endpoint: ${message}`, 'NETWORK_ERROR', 502);
    }

    if (response.status === 401 || response.status === 403) {
      throw new AiProviderError('NVIDIA NIM authentication failed. Check your API key configuration.', 'AUTH_ERROR', 502);
    }

    if (response.status === 429) {
      if (attempt < MAX_TRANSIENT_RETRIES && chunksEmitted === 0) {
        continue;
      }
      throw new AiProviderError('NVIDIA NIM rate limit exceeded. Please wait a moment before trying again.', 'RATE_LIMITED', 429);
    }

    if (response.status === 404 || response.status === 410) {
      throw new AiProviderError(`NVIDIA NIM model "${model}" not found or unavailable at endpoint (HTTP ${response.status}).`, 'MODEL_UNAVAILABLE', 502);
    }

    if (response.status === 400 && options.tools_enabled !== false) {
      let errDetails = '';
      try {
        errDetails = await response.text();
      } catch {}
      if (errDetails.toLowerCase().includes('tool') || errDetails.toLowerCase().includes('function')) {
        return streamAiChat(
          messages,
          { ...options, tools_enabled: false },
          config,
          onChunk,
          onToolCall,
          signal
        );
      }
      throw new AiProviderError(`NVIDIA NIM provider error: ${errDetails || 'Bad Request'}`, 'PROVIDER_ERROR', 400);
    }

    if (!response.ok) {
      let errDetails = `HTTP ${response.status}`;
      try {
        const text = await response.text();
        const parsed = JSON.parse(text);
        if (parsed.error?.message) errDetails = parsed.error.message;
        else if (parsed.detail) errDetails = parsed.detail;
      } catch {}
      throw new AiProviderError(`NVIDIA NIM provider error: ${errDetails}`, 'PROVIDER_ERROR', 502);
    }

    if (!response.body) {
      throw new AiProviderError('NVIDIA NIM response returned no body stream.', 'PROVIDER_ERROR', 502);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let retryNeeded = false;
    let fallbackReasoning = '';
    const accumulatedToolCalls = new Map<number, { index: number; id: string; name: string; arguments: string }>();

    const emitAccumulatedToolCalls = () => {
      if (accumulatedToolCalls.size > 0 && onToolCall) {
        const MAX_TOOL_CALLS_PER_TURN = 3;
        let count = 0;
        for (const tc of accumulatedToolCalls.values()) {
          if (count >= MAX_TOOL_CALLS_PER_TURN) break;
          count++;
          const validated = validateMimiOsToolCall({
            id: tc.id || `call-${Date.now()}-${count}`,
            name: tc.name,
            arguments: tc.arguments,
          });
          chunksEmitted++;
          onToolCall(validated);
        }
        accumulatedToolCalls.clear();
      }
    };

    try {
      while (true) {
        if (signal?.aborted) {
          await reader.cancel();
          return;
        }

        const { done, value } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          if (buffer.trim()) {
            const finalLines = buffer.split(/\r?\n/);
            for (const finalLine of finalLines) {
              const trimmed = finalLine.trim();
              if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
                try {
                  const data = JSON.parse(trimmed.slice(6));
                  const delta = data.choices?.[0]?.delta;
                  if (typeof delta?.content === 'string' && delta.content.length > 0) {
                    chunksEmitted++;
                    onChunk(delta.content);
                  } else if (typeof delta?.reasoning_content === 'string') {
                    fallbackReasoning += delta.reasoning_content;
                  }
                  if (Array.isArray(delta?.tool_calls)) {
                    for (const tc of delta.tool_calls) {
                      const idx = typeof tc.index === 'number' ? tc.index : 0;
                      let existing = accumulatedToolCalls.get(idx);
                      if (!existing) {
                        existing = { index: idx, id: tc.id || '', name: '', arguments: '' };
                        accumulatedToolCalls.set(idx, existing);
                      }
                      if (tc.id) existing.id = tc.id;
                      if (tc.function?.name) existing.name += tc.function.name;
                      if (tc.function?.arguments) existing.arguments += tc.function.arguments;
                    }
                  }
                } catch {}
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
            if (accumulatedToolCalls.size > 0) {
              emitAccumulatedToolCalls();
              return;
            }
            if (chunksEmitted === 0 && fallbackReasoning.trim().length > 0) {
              chunksEmitted++;
              onChunk(fallbackReasoning);
            }
            return;
          }

          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const data = JSON.parse(jsonStr) as {
                choices?: Array<{
                  delta?: {
                    content?: string;
                    reasoning_content?: string;
                    tool_calls?: Array<{
                      index?: number;
                      id?: string;
                      type?: string;
                      function?: { name?: string; arguments?: string };
                    }>;
                  };
                  finish_reason?: string | null;
                }>;
                error?: { message?: string; type?: string; code?: number | string } | string;
                detail?: string;
              };

              // In-stream error frame detection
              if (data.error) {
                const errMsg = typeof data.error === 'string'
                  ? data.error
                  : data.error.message || 'Upstream provider error during streaming';
                const isResourceExhausted = errMsg.includes('ResourceExhausted') || errMsg.includes('limit reached');

                // If transient worker resource exhausted and no chunks delivered yet, retry
                if (isResourceExhausted && chunksEmitted === 0 && attempt < MAX_TRANSIENT_RETRIES) {
                  retryNeeded = true;
                  break;
                }

                throw new AiProviderError(
                  errMsg,
                  isResourceExhausted ? 'RATE_LIMITED' : 'PROVIDER_ERROR',
                  isResourceExhausted ? 429 : 502
                );
              }

              if (data.detail) {
                throw new AiProviderError(data.detail, 'PROVIDER_ERROR', 502);
              }

              const delta = data.choices?.[0]?.delta;
              if (typeof delta?.content === 'string' && delta.content.length > 0) {
                chunksEmitted++;
                onChunk(delta.content);
              } else if (typeof delta?.reasoning_content === 'string') {
                fallbackReasoning += delta.reasoning_content;
              }

              // Accumulate streaming tool call deltas
              if (Array.isArray(delta?.tool_calls)) {
                for (const tc of delta.tool_calls) {
                  const idx = typeof tc.index === 'number' ? tc.index : 0;
                  let existing = accumulatedToolCalls.get(idx);
                  if (!existing) {
                    existing = { index: idx, id: tc.id || '', name: '', arguments: '' };
                    accumulatedToolCalls.set(idx, existing);
                  }
                  if (tc.id) existing.id = tc.id;
                  if (tc.function?.name) existing.name += tc.function.name;
                  if (tc.function?.arguments) existing.arguments += tc.function.arguments;
                }
              }
            } catch (parseErr) {
              if (parseErr instanceof AiProviderError) throw parseErr;
              // Ignore non-fatal JSON parse errors for intermediate fragments
            }
          }
        }

        if (retryNeeded) break;
      }
    } catch (err: unknown) {
      if (signal?.aborted) return;
      if (err instanceof AiProviderError) throw err;
      const message = err instanceof Error ? err.message : 'Stream reading error';
      throw new AiProviderError(`Error while reading stream from NVIDIA NIM: ${message}`, 'PROVIDER_ERROR', 502);
    } finally {
      reader.releaseLock();
    }

    if (retryNeeded) {
      continue;
    }

    if (accumulatedToolCalls.size > 0) {
      emitAccumulatedToolCalls();
      return;
    }

    // If stream ended with 0 content tokens, but reasoning tokens were produced:
    if (chunksEmitted === 0 && fallbackReasoning.trim().length > 0) {
      chunksEmitted++;
      onChunk(fallbackReasoning);
      return;
    }

    return;
  }
}

export async function sendAiChat(
  messages: ChatMessage[],
  options: ChatOptions,
  config: RuntimeConfig,
  signal?: AbortSignal
): Promise<{ content: string; model: string; tool_calls?: ValidatedToolCall[] }> {
  let fullContent = '';
  const deliveredToolCalls: ValidatedToolCall[] = [];

  await streamAiChat(
    messages,
    options,
    config,
    (chunk) => {
      fullContent += chunk;
    },
    (toolCall) => {
      deliveredToolCalls.push(toolCall);
    },
    signal
  );

  return {
    content: fullContent,
    model: config.NVIDIA_NIM_MODEL || 'meta/llama-3.1-70b-instruct',
    tool_calls: deliveredToolCalls.length > 0 ? deliveredToolCalls : undefined,
  };
}
