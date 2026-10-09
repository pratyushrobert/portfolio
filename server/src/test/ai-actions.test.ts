import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { closeDatabase, initializeDatabase } from '../db/index.js';
import { loadTestConfig } from './test-app.js';
import {
  APPROVED_APP_IDS,
  RESTRICTED_APP_IDS,
  CONFIRMATION_REQUIRED_APPS,
  MIMIOS_TOOL_DEFINITIONS,
  normalizeAppId,
  isAppApproved,
  isAppRestricted,
  normalizePath,
  validateMimiOsToolCall,
} from '../services/ai-tools.js';
import { aiChatMessageSchema, aiChatRequestSchema } from '../schemas/index.js';

describe('MimiAI Restricted MimiOS Tool & Action System', () => {
  describe('Phase 1 & 2: Approved Action Registry & Tool Definitions', () => {
    it('defines the 4 required MimiOS actions in OpenAI-compatible format', () => {
      const toolNames = MIMIOS_TOOL_DEFINITIONS.map((t) => t.function.name);
      expect(toolNames).toContain('open_app');
      expect(toolNames).toContain('close_app');
      expect(toolNames).toContain('focus_app');
      expect(toolNames).toContain('navigate_filesystem');
      expect(MIMIOS_TOOL_DEFINITIONS).toHaveLength(4);
    });

    it('whitelists user-accessible desktop applications only', () => {
      expect(APPROVED_APP_IDS).toContain('files');
      expect(APPROVED_APP_IDS).toContain('terminal');
      expect(APPROVED_APP_IDS).toContain('about');
      expect(APPROVED_APP_IDS).toContain('projects');
      expect(APPROVED_APP_IDS).toContain('skills');
      expect(APPROVED_APP_IDS).toContain('experience');
      expect(APPROVED_APP_IDS).toContain('certificates');
      expect(APPROVED_APP_IDS).toContain('resume');
      expect(APPROVED_APP_IDS).toContain('editor');
      expect(APPROVED_APP_IDS).toContain('settings');
      expect(APPROVED_APP_IDS).toContain('contact');
      expect(APPROVED_APP_IDS).toContain('snake');
      expect(APPROVED_APP_IDS).toContain('mimi-ai');

      // Ensure no administrative app is in the approved list
      for (const restricted of RESTRICTED_APP_IDS) {
        expect(APPROVED_APP_IDS).not.toContain(restricted);
      }
    });

    it('normalizes common application aliases correctly', () => {
      expect(normalizeAppId('mimiai')).toBe('mimi-ai');
      expect(normalizeAppId('file-manager')).toBe('files');
      expect(normalizeAppId('code-editor')).toBe('editor');
      expect(normalizeAppId('snake-game')).toBe('snake');
      expect(normalizeAppId('resume-viewer')).toBe('resume');
      expect(normalizeAppId('PDF-VIEWER')).toBe('resume');
    });

    it('correctly validates allowed open_app action', () => {
      const result = validateMimiOsToolCall({
        id: 'call-1',
        name: 'open_app',
        arguments: JSON.stringify({ appId: 'projects' }),
      });

      expect(result.valid).toBe(true);
      expect(result.name).toBe('open_app');
      expect(result.arguments).toEqual({ appId: 'projects' });
      expect(result.requiresConfirmation).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it('correctly validates allowed focus_app action', () => {
      const result = validateMimiOsToolCall({
        id: 'call-2',
        name: 'focus_app',
        arguments: { appId: 'files' },
      });

      expect(result.valid).toBe(true);
      expect(result.name).toBe('focus_app');
      expect(result.arguments).toEqual({ appId: 'files' });
      expect(result.requiresConfirmation).toBe(false);
    });

    it('correctly validates allowed navigate_filesystem action with safe path', () => {
      const result = validateMimiOsToolCall({
        id: 'call-3',
        name: 'navigate_filesystem',
        arguments: { path: '/home/pratyush/documents' },
      });

      expect(result.valid).toBe(true);
      expect(result.name).toBe('navigate_filesystem');
      expect(result.arguments).toEqual({ path: '/home/pratyush/documents' });
      expect(result.requiresConfirmation).toBe(false);
    });

    it('normalizes relative filesystem paths to /home/pratyush directory', () => {
      expect(normalizePath('projects')).toBe('/home/pratyush/projects');
      expect(normalizePath('./skills')).toBe('/home/pratyush/skills');
      expect(normalizePath('/home/pratyush/skills/../documents')).toBe('/home/pratyush/documents');
    });
  });

  describe('Phase 3: Permissions, Security Boundaries & Confirmation', () => {
    it('strictly denies open_app for administrative / restricted portals', () => {
      const adminApps = ['admin-portal', 'admin-login', 'admin', 'admin_panel', 'auth_manager'];
      for (const adminApp of adminApps) {
        expect(isAppRestricted(adminApp)).toBe(true);

        const result = validateMimiOsToolCall({
          id: 'call-bad-admin',
          name: 'open_app',
          arguments: { appId: adminApp },
        });

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Access Denied');
        expect(result.error).toContain('administrative or restricted portal');
      }
    });

    it('rejects unknown or unregistered application IDs', () => {
      const result = validateMimiOsToolCall({
        id: 'call-unknown',
        name: 'open_app',
        arguments: { appId: 'calculator-3000' },
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown application ID');
      expect(result.error).toContain('calculator-3000');
    });

    it('requires confirmation when closing sensitive work apps (editor, terminal)', () => {
      for (const sensitiveApp of CONFIRMATION_REQUIRED_APPS) {
        const result = validateMimiOsToolCall({
          id: `call-close-${sensitiveApp}`,
          name: 'close_app',
          arguments: { appId: sensitiveApp },
        });

        expect(result.valid).toBe(true);
        expect(result.requiresConfirmation).toBe(true);
      }
    });

    it('does NOT require confirmation when closing non-destructive apps (files, snake, about)', () => {
      const safeApps = ['files', 'snake', 'about', 'skills', 'projects'];
      for (const safeApp of safeApps) {
        const result = validateMimiOsToolCall({
          id: `call-close-${safeApp}`,
          name: 'close_app',
          arguments: { appId: safeApp },
        });

        expect(result.valid).toBe(true);
        expect(result.requiresConfirmation).toBe(false);
      }
    });

    it('allows closing contextual window ("current", "active", "this") without confirmation', () => {
      const result = validateMimiOsToolCall({
        id: 'call-close-curr',
        name: 'close_app',
        arguments: { appId: 'current' },
      });

      expect(result.valid).toBe(true);
      expect(result.requiresConfirmation).toBe(false);
    });

    it('denies access to paths containing .secret or secret keywords', () => {
      const deniedPaths = [
        '/.secret',
        '/home/pratyush/.secret',
        '/home/pratyush/secret/keys.txt',
        '/var/secrets/admin',
        '.secret',
      ];

      for (const deniedPath of deniedPaths) {
        const result = validateMimiOsToolCall({
          id: 'call-sec-path',
          name: 'navigate_filesystem',
          arguments: { path: deniedPath },
        });

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Access Denied');
        expect(result.error).toContain('restricted or private');
      }
    });

    it('denies access to administrative directory paths (/admin)', () => {
      const adminPaths = ['/admin', '/admin/system', '/home/admin'];
      for (const adminPath of adminPaths) {
        const result = validateMimiOsToolCall({
          id: 'call-adm-path',
          name: 'navigate_filesystem',
          arguments: { path: adminPath },
        });

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Access Denied');
        expect(result.error).toContain('Administrative path');
      }
    });

    it('prevents path traversal outside root filesystem', () => {
      const traversalPath = '/home/pratyush/../../../../etc/passwd';
      const normalized = normalizePath(traversalPath);
      // Normalized should be safely bounded inside root virtual directory
      expect(normalized.startsWith('/')).toBe(true);
      expect(normalized).toBe('/etc/passwd');
    });

    it('rejects control characters, shell metacharacters, or script tags in paths', () => {
      const maliciousPaths = [
        '/home/pratyush/<script>',
        '/home/pratyush|rm -rf',
        '/home/pratyush\x00secret',
        '/home/pratyush:test',
        '/home/pratyush*all',
      ];

      for (const badPath of maliciousPaths) {
        const result = validateMimiOsToolCall({
          id: 'call-bad-chars',
          name: 'navigate_filesystem',
          arguments: { path: badPath },
        });

        expect(result.valid).toBe(false);
        expect(result.error).toContain('illegal control characters');
      }
    });

    it('rejects model hallucinations attempting unauthorized action names', () => {
      const hallucinatedActions = [
        'exec_command',
        'run_shell',
        'eval_js',
        'delete_file',
        'modify_database',
        'curl',
      ];

      for (const action of hallucinatedActions) {
        const result = validateMimiOsToolCall({
          id: 'call-hallucinated',
          name: action,
          arguments: {},
        });

        expect(result.valid).toBe(false);
        expect(result.error).toContain('not a recognized MimiOS action');
      }
    });

    it('handles malformed JSON arguments gracefully without crashing', () => {
      const result = validateMimiOsToolCall({
        id: 'call-malformed-json',
        name: 'open_app',
        arguments: '{ appId: broken_json...',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Malformed JSON arguments');
    });

    it('handles missing required arguments gracefully', () => {
      const emptyApp = validateMimiOsToolCall({
        id: 'call-missing-app',
        name: 'open_app',
        arguments: {},
      });
      expect(emptyApp.valid).toBe(false);
      expect(emptyApp.error).toContain('Missing required "appId" parameter');

      const emptyPath = validateMimiOsToolCall({
        id: 'call-missing-path',
        name: 'navigate_filesystem',
        arguments: {},
      });
      expect(emptyPath.valid).toBe(false);
      expect(emptyPath.error).toContain('Missing required "path" parameter');
    });
  });

  describe('Zod Schema Integration: Multi-turn Chat & Tool Messages', () => {
    it('validates user messages', () => {
      const validUser = aiChatMessageSchema.safeParse({
        role: 'user',
        content: 'Open the projects window please',
      });
      expect(validUser.success).toBe(true);
    });

    it('validates assistant messages with tool_calls', () => {
      const validAssistantWithTools = aiChatMessageSchema.safeParse({
        role: 'assistant',
        tool_calls: [
          {
            id: 'call-101',
            type: 'function',
            function: {
              name: 'open_app',
              arguments: '{"appId":"projects"}',
            },
          },
        ],
      });
      expect(validAssistantWithTools.success).toBe(true);
    });

    it('validates assistant messages with both content and tool_calls', () => {
      const validAssistantBoth = aiChatMessageSchema.safeParse({
        role: 'assistant',
        content: 'Opening projects portfolio for you.',
        tool_calls: [
          {
            id: 'call-102',
            type: 'function',
            function: {
              name: 'open_app',
              arguments: '{"appId":"projects"}',
            },
          },
        ],
      });
      expect(validAssistantBoth.success).toBe(true);
    });

    it('rejects assistant messages with neither content nor tool_calls', () => {
      const invalidAssistant = aiChatMessageSchema.safeParse({
        role: 'assistant',
      });
      expect(invalidAssistant.success).toBe(false);
    });

    it('validates tool response messages with tool_call_id and JSON content', () => {
      const validToolResult = aiChatMessageSchema.safeParse({
        role: 'tool',
        tool_call_id: 'call-101',
        content: JSON.stringify({ success: true, message: 'Projects opened successfully.' }),
      });
      expect(validToolResult.success).toBe(true);
    });

    it('validates entire multi-turn conversation with tools_enabled flag', () => {
      const fullConversation = {
        messages: [
          { role: 'user', content: 'Can you show me your projects?' },
          {
            role: 'assistant',
            content: 'I will open the Projects application.',
            tool_calls: [
              {
                id: 'call-p1',
                type: 'function' as const,
                function: { name: 'open_app', arguments: '{"appId":"projects"}' },
              },
            ],
          },
          {
            role: 'tool',
            tool_call_id: 'call-p1',
            content: '{"success":true,"action":"open_app","appId":"projects"}',
          },
        ],
        stream: true,
        tools_enabled: false,
      };

      const result = aiChatRequestSchema.safeParse(fullConversation);
      expect(result.success).toBe(true);
    });
  });

  describe('Fastify Server SSE Streaming & Tool Call Execution', () => {
    let app: FastifyInstance;
    const config = loadTestConfig();
    let db: Awaited<ReturnType<typeof initializeDatabase>>;

    beforeAll(async () => {
      db = await initializeDatabase(config);
      const configWithKey = {
        ...config,
        NVIDIA_API_KEY: 'nvapi-mock-key-for-tool-actions',
        NVIDIA_NIM_MODEL: 'meta/llama-3.1-70b-instruct',
      };
      app = await buildApp({ database: db, config: configWithKey });
      await app.ready();
    });

    afterAll(async () => {
      await app.close();
      await closeDatabase(db);
    });

    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('emits validated tool_call SSE frame when model issues an action', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        const sseStream = new ReadableStream({
          start(controller) {
            const chunks = [
              'data: {"id":"chat-1","choices":[{"index":0,"delta":{"content":"Launching File Manager...\\n"},"finish_reason":null}]}\n\n',
              'data: {"id":"chat-1","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call-files-1","type":"function","function":{"name":"open_app","arguments":"{\\"appId\\":\\"files\\"}"}}]},"finish_reason":"tool_calls"}]}\n\n',
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

      const res = await app.inject({
        method: 'POST',
        url: '/api/ai/chat',
        payload: {
          messages: [{ role: 'user', content: 'Open my files please' }],
          stream: true,
          tools_enabled: true,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/event-stream');
      expect(res.payload).toContain('data: {"chunk":"Launching File Manager...\\n"}');
      expect(res.payload).toContain('data: {"tool_call":');
      expect(res.payload).toContain('"name":"open_app"');
      expect(res.payload).toContain('"appId":"files"');
      expect(res.payload).toContain('"valid":true');
      expect(res.payload).toContain('data: [DONE]');
    });

    it('emits tool_call with valid:false when model attempts restricted admin portal', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        const sseStream = new ReadableStream({
          start(controller) {
            const chunks = [
              'data: {"id":"chat-2","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call-adm-1","type":"function","function":{"name":"open_app","arguments":"{\\"appId\\":\\"admin-portal\\"}"}}]},"finish_reason":"tool_calls"}]}\n\n',
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

      const res = await app.inject({
        method: 'POST',
        url: '/api/ai/chat',
        payload: {
          messages: [{ role: 'user', content: 'Open admin portal' }],
          stream: true,
          tools_enabled: true,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.payload).toContain('data: {"tool_call":');
      expect(res.payload).toContain('"valid":false');
      expect(res.payload).toContain('Access Denied');
    });

    it('emits tool_call with requiresConfirmation:true for editor/terminal closure', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        const sseStream = new ReadableStream({
          start(controller) {
            const chunks = [
              'data: {"id":"chat-3","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call-close-ed","type":"function","function":{"name":"close_app","arguments":"{\\"appId\\":\\"editor\\"}"}}]},"finish_reason":"tool_calls"}]}\n\n',
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

      const res = await app.inject({
        method: 'POST',
        url: '/api/ai/chat',
        payload: {
          messages: [{ role: 'user', content: 'Close code editor' }],
          stream: true,
          tools_enabled: true,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.payload).toContain('data: {"tool_call":');
      expect(res.payload).toContain('"valid":true');
      expect(res.payload).toContain('"requiresConfirmation":true');
    });

    it('processes multi-turn follow-up with tools_enabled: false preventing tool recursion', async () => {
      let passedBody: Record<string, unknown> | null = null;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
        if (init?.body && typeof init.body === 'string') {
          passedBody = JSON.parse(init.body);
        }

        const sseStream = new ReadableStream({
          start(controller) {
            const chunks = [
              'data: {"id":"chat-4","choices":[{"index":0,"delta":{"content":"I have navigated your file manager to /home/pratyush/documents."},"finish_reason":"stop"}]}\n\n',
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

      const res = await app.inject({
        method: 'POST',
        url: '/api/ai/chat',
        payload: {
          messages: [
            { role: 'user', content: 'Go to documents' },
            {
              role: 'assistant',
              content: 'Navigating now.',
              tool_calls: [
                {
                  id: 'call-nav-1',
                  type: 'function',
                  function: {
                    name: 'navigate_filesystem',
                    arguments: '{"path":"/home/pratyush/documents"}',
                  },
                },
              ],
            },
            {
              role: 'tool',
              tool_call_id: 'call-nav-1',
              content: '{"success":true,"action":"navigate_filesystem","path":"/home/pratyush/documents"}',
            },
          ],
          stream: true,
          tools_enabled: false,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.payload).toContain('I have navigated your file manager');
      // Verify tools was NOT sent to upstream model when tools_enabled is false
      expect(passedBody).not.toBeNull();
      expect(passedBody?.tools).toBeUndefined();
    });
  });
});
