import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send,
  Square,
  Plus,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  MessageSquare,
  Sparkles,
  Shield,
  Terminal,
  Code2,
  AlertTriangle,
} from 'lucide-react';
import {
  aiApi,
  type AiStatus,
  type ChatMessage,
  type ValidatedToolCall,
} from '../../lib/api/ai';
import {
  executeMimiOsAction,
  type MimiActionName,
  type ActionResult,
} from '../../lib/ai/actions';
import { MimiMascot } from './MimiMascot';
import { MarkdownRenderer } from './MarkdownRenderer';
import type { DesktopOpenRequest } from '../../types/desktop';
import './MimiAI.css';

export interface ActionExecutionState {
  id: string;
  name: MimiActionName;
  arguments: Record<string, unknown>;
  status:
    | 'preparing'
    | 'awaiting_confirmation'
    | 'executing'
    | 'confirmed'
    | 'failed'
    | 'cancelled';
  requiresConfirmation: boolean;
  result?: ActionResult;
  error?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: number;
  toolCalls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  toolCallId?: string;
  action?: ActionExecutionState;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  messages: Message[];
}

interface MimiAIAppProps {
  windowId: string;
  appParams?: Record<string, unknown>;
  onOpenRequest?: (request: DesktopOpenRequest) => void;
}

const STORAGE_KEY = 'mimios_ai_conversations_v1';

const QUICK_PROMPTS = [
  {
    tag: 'Cybersecurity',
    icon: Shield,
    text: 'Analyze Nmap scan techniques & how stealth SYN scans (-sS) evade basic detection.',
  },
  {
    tag: 'Web Security',
    icon: Sparkles,
    text: 'Explain CSRF vs XSS defenses and how SameSite cookies protect session tokens.',
  },
  {
    tag: 'Linux & Net',
    icon: Terminal,
    text: 'Explain TCP 3-way handshake states and useful Wireshark packet capture filters.',
  },
  {
    tag: 'MimiOS Internals',
    icon: Code2,
    text: 'How does the MimiOS VirtualFS architecture and terminal command registry work?',
  },
];

export function MimiAIApp({ windowId: _windowId, appParams }: MimiAIAppProps) {
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((conv: Conversation) => ({
            ...conv,
            messages: Array.isArray(conv.messages)
              ? conv.messages.filter(
                  (m: Message) => m && typeof m.content === 'string' && m.content.trim().length > 0
                )
              : [],
          }));
        }
      }
    } catch {
      // Ignore storage parse errors
    }
    const defaultConv: Conversation = {
      id: 'conv-default',
      title: 'New Investigation',
      createdAt: Date.now(),
      messages: [],
    };
    return [defaultConv];
  });

  const [activeConvId, setActiveConvId] = useState<string>(() => conversations[0]?.id || 'conv-default');
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isSubmittingRef = useRef(false);
  const handledInitialPromptRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const conversationsRef = useRef(conversations);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const activeConversation = conversations.find((c) => c.id === activeConvId) || conversations[0];

  const formatActionArgs = (args: Record<string, unknown>): string => {
    if (typeof args.appId === 'string') return `appId: "${args.appId}"`;
    if (typeof args.path === 'string') return `path: "${args.path}"`;
    return JSON.stringify(args);
  };

  const executeFollowUpTurn = useCallback(
    async (
      _originAssistantId: string,
      toolCallId: string,
      actionResult: ActionResult
    ) => {
      const currentConv = conversationsRef.current.find((c) => c.id === activeConvId);
      if (!currentConv) return;

      const followUpAssistantId = `msg-${Date.now()}-a`;
      const followUpAssistantMsg: Message = {
        id: followUpAssistantId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };

      const toolMsgId = `msg-${Date.now()}-t`;
      const toolMsg: Message = {
        id: toolMsgId,
        role: 'tool',
        content: JSON.stringify(actionResult),
        toolCallId,
        timestamp: Date.now(),
      };

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === activeConvId) {
            return {
              ...c,
              messages: [...c.messages, toolMsg, followUpAssistantMsg],
            };
          }
          return c;
        })
      );

      setIsGenerating(true);
      const followUpAbortController = new AbortController();
      abortControllerRef.current = followUpAbortController;

      try {
        const updatedMessages = [...currentConv.messages, toolMsg];
        const chatPayload: ChatMessage[] = [];
        for (const m of updatedMessages) {
          if (m.role === 'tool') {
            chatPayload.push({
              role: 'tool',
              tool_call_id: m.toolCallId || toolCallId,
              content: m.content,
            });
          } else if (m.role === 'assistant') {
            chatPayload.push({
              role: 'assistant',
              content: m.content || undefined,
              tool_calls: m.toolCalls,
            });
          } else if (m.role === 'user') {
            chatPayload.push({
              role: 'user',
              content: m.content,
            });
          }
        }

        let followUpAccumulated = '';
        await aiApi.streamChat(
          chatPayload,
          { temperature: 0.6, tools_enabled: false },
          (chunk) => {
            followUpAccumulated += chunk;
            setConversations((prev) =>
              prev.map((c) => {
                if (c.id === activeConvId) {
                  return {
                    ...c,
                    messages: c.messages.map((item) =>
                      item.id === followUpAssistantId
                        ? { ...item, content: followUpAccumulated }
                        : item
                    ),
                  };
                }
                return c;
              })
            );
          },
          undefined,
          followUpAbortController.signal
        );
      } catch (err: unknown) {
        if (!followUpAbortController.signal.aborted) {
          const errMsg = err instanceof Error ? err.message : 'Follow-up inference failed';
          setErrorBanner(errMsg);
        }
      } finally {
        setIsGenerating(false);
        abortControllerRef.current = null;
      }
    },
    [activeConvId]
  );

  const handleConfirmAction = useCallback(
    async (msgId: string, actionState: ActionExecutionState) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === activeConvId) {
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id === msgId && m.action
                  ? { ...m, action: { ...m.action, status: 'executing' } }
                  : m
              ),
            };
          }
          return c;
        })
      );

      const result = await executeMimiOsAction(actionState.name, actionState.arguments, _windowId);

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === activeConvId) {
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id === msgId && m.action
                  ? { ...m, action: { ...m.action, status: result.success ? 'confirmed' : 'failed', result } }
                  : m
              ),
            };
          }
          return c;
        })
      );

      await executeFollowUpTurn(msgId, actionState.id, result);
    },
    [activeConvId, _windowId, executeFollowUpTurn]
  );

  const handleCancelAction = useCallback(
    async (msgId: string, actionState: ActionExecutionState) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === activeConvId) {
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id === msgId && m.action
                  ? { ...m, action: { ...m.action, status: 'cancelled' } }
                  : m
              ),
            };
          }
          return c;
        })
      );

      const cancelResult: ActionResult = {
        success: false,
        action: actionState.name,
        error: 'User cancelled the action confirmation request.',
      };
      await executeFollowUpTurn(msgId, actionState.id, cancelResult);
    },
    [activeConvId, executeFollowUpTurn]
  );

  // Component unmount cleanup to avoid dangling fetch/abort
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // Persist conversations to localStorage safely
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch {
      // Storage quota or privacy restriction
    }
  }, [conversations]);

  // Fetch AI status on mount
  useEffect(() => {
    let active = true;
    aiApi
      .getStatus()
      .then((status) => {
        if (active) {
          setAiStatus(status);
          setStatusLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setStatusLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  // Handle initial prompt from appParams (e.g. from terminal command: `mimi ai <prompt>`)
  useEffect(() => {
    if (appParams?.initialPrompt && typeof appParams.initialPrompt === 'string') {
      const prompt = appParams.initialPrompt.trim();
      if (prompt && handledInitialPromptRef.current !== prompt) {
        handledInitialPromptRef.current = prompt;
        setInput(prompt);
      }
    }
  }, [appParams]);

  // Auto-scroll to bottom of message list
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom(false);
  }, [activeConvId, scrollToBottom]);

  useEffect(() => {
    if (isGenerating) {
      scrollToBottom(true);
    }
  }, [isGenerating, activeConversation?.messages, scrollToBottom]);

  // Handle auto-resizing textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  };

  // Create new conversation
  const handleNewConversation = () => {
    if (isGenerating) handleStopGeneration();
    const newConv: Conversation = {
      id: `conv-${Date.now()}`,
      title: 'New Investigation',
      createdAt: Date.now(),
      messages: [],
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveConvId(newConv.id);
    setErrorBanner(null);
    setInput('');
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  // Delete conversation
  const handleDeleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGenerating && activeConvId === id) {
      handleStopGeneration();
    }
    setConversations((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      if (filtered.length === 0) {
        const fallback: Conversation = {
          id: `conv-${Date.now()}`,
          title: 'New Investigation',
          createdAt: Date.now(),
          messages: [],
        };
        setActiveConvId(fallback.id);
        return [fallback];
      }
      if (activeConvId === id) {
        setActiveConvId(filtered[0].id);
      }
      return filtered;
    });
  };

  // Clear all history
  const handleClearAllHistory = () => {
    if (isGenerating) handleStopGeneration();
    const fresh: Conversation = {
      id: `conv-${Date.now()}`,
      title: 'New Investigation',
      createdAt: Date.now(),
      messages: [],
    };
    setConversations([fresh]);
    setActiveConvId(fresh.id);
    setErrorBanner(null);
  };

  // Stop Generation
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
  };

  // Send message
  const handleSendMessage = async (textToSend?: string) => {
    // 1. Capture text first
    const rawText = typeof textToSend === 'string' ? textToSend : input;
    const trimmed = rawText.trim();

    // 2. Prevent submission if empty or if generation is already in progress
    if (!trimmed || isGenerating || isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    setErrorBanner(null);

    // 3. Clear the input and reset textarea height only AFTER capturing the valid trimmed prompt
    if (textToSend === undefined) {
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }

    const userMsg: Message = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    };

    const assistantMsgId = `msg-${Date.now() + 1}-a`;
    const initialAssistantMsg: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };

    // Filter previous messages strictly to non-empty trimmed content
    const previousValidMessages = activeConversation.messages.filter(
      (m) => typeof m.content === 'string' && m.content.trim().length > 0
    );

    // Update conversation title if this is the first message
    const isFirstMessage = previousValidMessages.length === 0;
    const computedTitle = isFirstMessage
      ? trimmed.slice(0, 36).trim() + (trimmed.length > 36 ? '...' : '')
      : activeConversation.title;

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === activeConvId) {
          return {
            ...c,
            title: computedTitle,
            messages: [...previousValidMessages, userMsg, initialAssistantMsg],
          };
        }
        return c;
      })
    );

    setIsGenerating(true);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const chatHistory: ChatMessage[] = [
      ...previousValidMessages.map((m) => {
        if (m.role === 'tool') {
          return {
            role: 'tool' as const,
            tool_call_id: m.toolCallId || '',
            content: m.content.trim(),
          };
        }
        if (m.role === 'assistant') {
          return {
            role: 'assistant' as const,
            content: m.content.trim() || undefined,
            tool_calls: m.toolCalls,
          };
        }
        return {
          role: m.role,
          content: m.content.trim(),
        };
      }),
      {
        role: userMsg.role,
        content: userMsg.content,
      },
    ];

    try {
      let accumulated = '';
      let detectedToolCall: ValidatedToolCall | null = null;
      await aiApi.streamChat(
        chatHistory,
        { temperature: 0.6 },
        (chunk) => {
          accumulated += chunk;
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id === activeConvId) {
                return {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantMsgId ? { ...m, content: accumulated } : m
                  ),
                };
              }
              return c;
            })
          );
        },
        (toolCall) => {
          detectedToolCall = toolCall;
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id === activeConvId) {
                return {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantMsgId
                      ? {
                          ...m,
                          action: {
                            id: toolCall.id,
                            name: toolCall.name as MimiActionName,
                            arguments: toolCall.arguments,
                            status: !toolCall.valid
                              ? 'failed'
                              : toolCall.requiresConfirmation
                              ? 'awaiting_confirmation'
                              : 'preparing',
                            requiresConfirmation: toolCall.requiresConfirmation,
                            error: toolCall.error,
                          },
                          toolCalls: [
                            {
                              id: toolCall.id,
                              type: 'function',
                              function: {
                                name: toolCall.name,
                                arguments: JSON.stringify(toolCall.arguments),
                              },
                            },
                          ],
                        }
                      : m
                  ),
                };
              }
              return c;
            })
          );
        },
        abortController.signal
      );

      if (detectedToolCall) {
        const tc = detectedToolCall as ValidatedToolCall;
        if (!tc.valid) {
          await executeFollowUpTurn(assistantMsgId, tc.id, {
            success: false,
            action: tc.name as MimiActionName,
            error: tc.error,
          });
        } else if (!tc.requiresConfirmation) {
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id === activeConvId) {
                return {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantMsgId && m.action
                      ? { ...m, action: { ...m.action, status: 'executing' } }
                      : m
                  ),
                };
              }
              return c;
            })
          );
          const result = await executeMimiOsAction(tc.name as MimiActionName, tc.arguments, _windowId);
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id === activeConvId) {
                return {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantMsgId && m.action
                      ? { ...m, action: { ...m.action, status: result.success ? 'confirmed' : 'failed', result } }
                      : m
                  ),
                };
              }
              return c;
            })
          );
          await executeFollowUpTurn(assistantMsgId, tc.id, result);
        }
      }
    } catch (err: unknown) {
      if (abortController.signal.aborted) {
        // Clean up empty assistant placeholder if aborted before content was produced
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id === activeConvId) {
              return {
                ...c,
                messages: c.messages.filter(
                  (m) => m.id !== assistantMsgId || m.content.trim().length > 0 || m.action !== undefined
                ),
              };
            }
            return c;
          })
        );
        return;
      }
      const errMsg = err instanceof Error ? err.message : 'AI inference failed';
      setErrorBanner(errMsg);
      // Clean up empty assistant placeholder on error to prevent corrupted subsequent messages
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === activeConvId) {
            return {
              ...c,
              messages: c.messages.filter(
                (m) => m.id !== assistantMsgId || m.content.trim().length > 0 || m.action !== undefined
              ),
            };
          }
          return c;
        })
      );
    } finally {
      isSubmittingRef.current = false;
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  // Regenerate last response
  const handleRegenerate = async () => {
    if (isGenerating || isSubmittingRef.current || activeConversation.messages.length < 1) return;

    const msgs = activeConversation.messages;
    const lastUserIdx = msgs.map((m) => m.role).lastIndexOf('user');
    if (lastUserIdx === -1) return;

    const targetUserMsg = msgs[lastUserIdx];
    if (!targetUserMsg || !targetUserMsg.content.trim()) return;

    isSubmittingRef.current = true;

    // Filter valid history strictly up to and including that user message
    const historyUpToUser = msgs
      .slice(0, lastUserIdx + 1)
      .filter((m) => typeof m.content === 'string' && m.content.trim().length > 0);

    const assistantMsgId = `msg-${Date.now()}-a`;
    const initialAssistantMsg: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === activeConvId) {
          return {
            ...c,
            messages: [...historyUpToUser, initialAssistantMsg],
          };
        }
        return c;
      })
    );

    setIsGenerating(true);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const chatHistory: ChatMessage[] = historyUpToUser.map((m) => ({
      role: m.role,
      content: m.content.trim(),
    }));

    try {
      let accumulated = '';
      let detectedToolCall: ValidatedToolCall | null = null;
      await aiApi.streamChat(
        chatHistory,
        { temperature: 0.6 },
        (chunk) => {
          accumulated += chunk;
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id === activeConvId) {
                return {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantMsgId ? { ...m, content: accumulated } : m
                  ),
                };
              }
              return c;
            })
          );
        },
        (toolCall) => {
          detectedToolCall = toolCall;
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id === activeConvId) {
                return {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantMsgId
                      ? {
                          ...m,
                          action: {
                            id: toolCall.id,
                            name: toolCall.name as MimiActionName,
                            arguments: toolCall.arguments,
                            status: !toolCall.valid
                              ? 'failed'
                              : toolCall.requiresConfirmation
                              ? 'awaiting_confirmation'
                              : 'preparing',
                            requiresConfirmation: toolCall.requiresConfirmation,
                            error: toolCall.error,
                          },
                          toolCalls: [
                            {
                              id: toolCall.id,
                              type: 'function',
                              function: {
                                name: toolCall.name,
                                arguments: JSON.stringify(toolCall.arguments),
                              },
                            },
                          ],
                        }
                      : m
                  ),
                };
              }
              return c;
            })
          );
        },
        abortController.signal
      );

      if (detectedToolCall) {
        const tc = detectedToolCall as ValidatedToolCall;
        if (!tc.valid) {
          await executeFollowUpTurn(assistantMsgId, tc.id, {
            success: false,
            action: tc.name as MimiActionName,
            error: tc.error,
          });
        } else if (!tc.requiresConfirmation) {
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id === activeConvId) {
                return {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantMsgId && m.action
                      ? { ...m, action: { ...m.action, status: 'executing' } }
                      : m
                  ),
                };
              }
              return c;
            })
          );
          const result = await executeMimiOsAction(tc.name as MimiActionName, tc.arguments, _windowId);
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id === activeConvId) {
                return {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantMsgId && m.action
                      ? { ...m, action: { ...m.action, status: result.success ? 'confirmed' : 'failed', result } }
                      : m
                  ),
                };
              }
              return c;
            })
          );
          await executeFollowUpTurn(assistantMsgId, tc.id, result);
        }
      }
    } catch (err: unknown) {
      if (abortController.signal.aborted) {
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id === activeConvId) {
              return {
                ...c,
                messages: c.messages.filter(
                  (m) => m.id !== assistantMsgId || m.content.trim().length > 0 || m.action !== undefined
                ),
              };
            }
            return c;
          })
        );
        return;
      }
      const errMsg = err instanceof Error ? err.message : 'AI inference failed';
      setErrorBanner(errMsg);
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === activeConvId) {
            return {
              ...c,
              messages: c.messages.filter(
                (m) => m.id !== assistantMsgId || m.content.trim().length > 0 || m.action !== undefined
              ),
            };
          }
          return c;
        })
      );
    } finally {
      isSubmittingRef.current = false;
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  // Copy full message
  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedMsgId(id);
      setTimeout(() => setCopiedMsgId(null), 2000);
    });
  };

  // Handle Keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isGenerating && input.trim()) {
        void handleSendMessage();
      }
    } else if (e.key === 'Escape') {
      if (isGenerating) {
        handleStopGeneration();
      }
    }
  };

  return (
    <div className="mimi-ai-window" role="region" aria-label="MimiAI Cybersecurity Assistant">
      {/* Collapsible Conversation History Sidebar */}
      <aside className={`mimi-ai-sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
        <div className="mimi-ai-sidebar-header">
          <span className="mimi-ai-sidebar-title">
            <MessageSquare size={13} /> Missions
          </span>
          <div className="mimi-ai-sidebar-actions">
            <button
              type="button"
              className="mimi-ai-icon-btn"
              onClick={handleNewConversation}
              title="New Investigation"
              aria-label="New Investigation"
            >
              <Plus size={14} />
            </button>
            <button
              type="button"
              className="mimi-ai-icon-btn"
              onClick={handleClearAllHistory}
              title="Clear All History"
              aria-label="Clear All History"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        <div className="mimi-ai-sidebar-list">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              type="button"
              className={`mimi-ai-conv-item ${conv.id === activeConvId ? 'active' : ''}`}
              onClick={() => {
                setActiveConvId(conv.id);
                setSidebarOpen(false);
              }}
            >
              <span className="mimi-ai-conv-label">{conv.title}</span>
              <button
                type="button"
                className="mimi-ai-conv-delete"
                onClick={(e) => handleDeleteConversation(conv.id, e)}
                title="Delete Investigation"
                aria-label="Delete Investigation"
              >
                <Trash2 size={12} />
              </button>
            </button>
          ))}
          {conversations.length === 0 && (
            <div className="mimi-ai-sidebar-empty">No active missions</div>
          )}
        </div>
      </aside>

      {/* Main Chat Interface */}
      <main className="mimi-ai-main">
        {/* App Header Bar */}
        <header className="mimi-ai-header">
          <div className="mimi-ai-header-left">
            <button
              type="button"
              className="mimi-ai-icon-btn"
              onClick={() => setSidebarOpen((prev) => !prev)}
              title={sidebarOpen ? 'Hide Missions' : 'View Missions'}
              aria-label="Toggle Missions Sidebar"
            >
              <MessageSquare size={14} />
            </button>

            <MimiMascot size={26} isThinking={isGenerating} glow={isGenerating} />

            <div className="mimi-ai-header-title">
              <h2>MimiAI</h2>
              <span>Cyber Ninja Cat • Security & Dev Companion</span>
            </div>
          </div>

          <div className="mimi-ai-header-right">
            <div
              className="mimi-ai-status-pill"
              title={
                aiStatus?.configured
                  ? `NVIDIA NIM Active: ${aiStatus.model}`
                  : 'NVIDIA NIM API Key Required on Server'
              }
            >
              <span
                className={`mimi-ai-status-dot ${aiStatus?.configured ? '' : 'warning'}`}
              />
              <span>
                {statusLoading
                  ? 'Connecting...'
                  : aiStatus?.configured
                  ? 'NIM Online'
                  : 'Key Needed'}
              </span>
            </div>

            <button
              type="button"
              className="mimi-ai-icon-btn"
              onClick={handleNewConversation}
              title="New Mission"
              aria-label="New Mission"
            >
              <Plus size={14} />
            </button>
          </div>
        </header>

        {/* Message Stream */}
        <div className="mimi-ai-messages">
          {activeConversation.messages.length === 0 ? (
            <div className="mimi-ai-welcome">
              <div className="mimi-ai-welcome-hero">
                <MimiMascot size={72} glow={true} />
              </div>
              <span className="mimi-ai-welcome-badge">
                <Sparkles size={11} /> Defensive AI Intelligence
              </span>
              <h1>MimiAI — Cyber Ninja Cat</h1>
              <p>
                Ready for recon, code review, Linux internals, or threat modeling.
                Ask a security question, paste a stack trace, or explore MimiOS architecture.
              </p>

              <div className="mimi-ai-suggestions">
                {QUICK_PROMPTS.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={idx}
                      className="mimi-ai-suggestion-card"
                      onClick={() => void handleSendMessage(item.text)}
                      role="button"
                      tabIndex={0}
                    >
                      <span className="mimi-ai-suggestion-tag">
                        <Icon size={12} /> {item.tag}
                      </span>
                      <span className="mimi-ai-suggestion-text">{item.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            activeConversation.messages
              .filter((m) => m.role !== 'tool')
              .map((msg, index) => {
                const isAssistant = msg.role === 'assistant';
                const isLastAssistant =
                  isAssistant && index === activeConversation.messages.filter((m) => m.role !== 'tool').length - 1;

                return (
                  <div key={msg.id} className={`mimi-ai-row ${msg.role}`}>
                    {isAssistant ? (
                      <div className="mimi-ai-bubble-assistant">
                        <div className="mimi-ai-avatar-col">
                          <MimiMascot
                            size={24}
                            isThinking={isGenerating && isLastAssistant}
                          />
                        </div>
                        <div className="mimi-ai-body-col">
                          <div className="mimi-ai-meta-bar">
                            <span className="mimi-ai-sender-name">
                              MimiAI
                              <span className="mimi-ai-sender-ninja-badge">NINJA</span>
                            </span>
                            <div className="mimi-ai-bubble-actions">
                              {msg.content && (
                                <button
                                  type="button"
                                  className="mimi-ai-action-btn"
                                  onClick={() => handleCopyMessage(msg.id, msg.content)}
                                  title="Copy Response"
                                >
                                  {copiedMsgId === msg.id ? (
                                    <>
                                      <Check size={11} /> Copied
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={11} /> Copy
                                    </>
                                  )}
                                </button>
                              )}
                              {isLastAssistant && !isGenerating && (
                                <button
                                  type="button"
                                  className="mimi-ai-action-btn"
                                  onClick={handleRegenerate}
                                  title="Regenerate Response"
                                >
                                  <RefreshCw size={11} /> Regenerate
                                </button>
                              )}
                            </div>
                          </div>

                          {msg.action && (
                            msg.action.status === 'awaiting_confirmation' ? (
                              <div className="mimi-ai-action-confirm-card">
                                <div className="mimi-ai-confirm-header">
                                  <AlertTriangle size={13} className="warning-icon" />
                                  <span>Action Confirmation Required</span>
                                </div>
                                <div className="mimi-ai-confirm-body">
                                  MimiAI is requesting to close application <strong>"{String(msg.action.arguments.appId || '')}"</strong>.
                                </div>
                                <div className="mimi-ai-confirm-actions">
                                  <button
                                    type="button"
                                    className="mimi-ai-confirm-btn"
                                    onClick={() => void handleConfirmAction(msg.id, msg.action!)}
                                  >
                                    Confirm Action
                                  </button>
                                  <button
                                    type="button"
                                    className="mimi-ai-cancel-btn"
                                    onClick={() => void handleCancelAction(msg.id, msg.action!)}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className={`mimi-ai-action-badge ${msg.action.status}`}>
                                <span className="mimi-ai-action-icon">
                                  {msg.action.status === 'confirmed' ? (
                                    <Check size={12} />
                                  ) : msg.action.status === 'failed' ? (
                                    <AlertTriangle size={12} />
                                  ) : msg.action.status === 'cancelled' ? (
                                    <Square size={12} />
                                  ) : (
                                    <Sparkles size={12} className="spin" />
                                  )}
                                </span>
                                <span className="mimi-ai-action-text">
                                  {msg.action.status === 'preparing' &&
                                    `Preparing action: ${msg.action.name}(${formatActionArgs(msg.action.arguments)})...`}
                                  {msg.action.status === 'executing' &&
                                    `Executing ${msg.action.name}...`}
                                  {msg.action.status === 'confirmed' &&
                                    (msg.action.result?.message || `Confirmed: ${msg.action.name} executed successfully.`)}
                                  {msg.action.status === 'failed' &&
                                    (msg.action.error || msg.action.result?.error || `Failed: ${msg.action.name}`)}
                                  {msg.action.status === 'cancelled' &&
                                    'Action cancelled by user.'}
                                </span>
                              </div>
                            )
                          )}

                          {msg.content ? (
                            <MarkdownRenderer content={msg.content} />
                          ) : isGenerating && isLastAssistant ? (
                            <span className="mimi-ai-typing-cursor" />
                          ) : null}

                          {isGenerating && isLastAssistant && msg.content && (
                            <span className="mimi-ai-typing-cursor" />
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="mimi-ai-bubble-user">{msg.content}</div>
                    )}
                  </div>
                );
              })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Footer / Input Bar */}
        <footer className="mimi-ai-footer">
          {errorBanner && (
            <div className="mimi-ai-error-banner" role="alert">
              <span>
                <AlertTriangle size={13} style={{ display: 'inline', marginRight: 6 }} />
                {errorBanner}
              </span>
              <button
                type="button"
                className="mimi-ai-action-btn"
                onClick={() => setErrorBanner(null)}
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="mimi-ai-input-box">
            <textarea
              ref={textareaRef}
              className="mimi-ai-textarea"
              placeholder="Ask MimiAI about cybersecurity, Linux, code review, or MimiOS..."
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              rows={1}
              aria-label="Ask MimiAI"
            />
            {isGenerating ? (
              <button
                type="button"
                className="mimi-ai-stop-btn"
                onClick={handleStopGeneration}
                title="Stop generation"
                aria-label="Stop generation"
              >
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                className="mimi-ai-submit-btn"
                onClick={() => void handleSendMessage()}
                disabled={!input.trim() || isGenerating}
                title="Send message (Enter)"
                aria-label="Send message"
              >
                <Send size={14} />
              </button>
            )}
          </div>

          <div className="mimi-ai-input-hints">
            <span>Enter to send • Shift + Enter for new line</span>
            <span>MimiOS Defensive AI • Educational simulations only</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
