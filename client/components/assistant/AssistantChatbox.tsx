'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot } from 'lucide-react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { apiFetch } from '@/lib/api';
import { getPageContext, PageContext } from '@/lib/page-context';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 't2c-assistant-chat';
const MAX_MESSAGES = 20;
const WELCOME_MESSAGE = "Hi 👋 I'm your Trash2Cash AI assistant. How can I help you?";
const BLOCKED_PROTOCOLS = new Set([
  'chrome-extension:',
  'about:',
  'blob:',
  'data:',
  'mailto:',
  'tel:',
  'javascript:',
]);
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
};

const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 list-disc pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="mb-1 last:mb-0">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  pre: ({ children }) => (
    <pre className="mb-2 overflow-x-auto rounded-lg bg-black/5 p-2 text-[0.85em]">
      {children}
    </pre>
  ),
  code: ({ inline, children }) =>
    inline ? (
      <code className="rounded bg-black/5 px-1 py-0.5 text-[0.85em]">{children}</code>
    ) : (
      <code className="block whitespace-pre-wrap text-[0.85em]">{children}</code>
    ),
};

function BotAvatar({
  className,
  iconClassName,
}: {
  className?: string;
  iconClassName?: string;
}) {
  return (
    <div
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--surface-soft)] text-[color:var(--brand)]',
        className,
      )}
      aria-hidden="true"
    >
      <Bot className={cn('h-4 w-4', iconClassName)} />
    </div>
  );
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function isRelativeUrl(value: string) {
  if (value.startsWith('//')) return false;
  return !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value);
}

function toSafeRequestUrl(rawUrl: string) {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  if (isRelativeUrl(trimmed)) {
    try {
      const base = new URL(window.location.href);
      return ALLOWED_PROTOCOLS.has(base.protocol) ? trimmed : null;
    } catch {
      return null;
    }
  }

  try {
    const parsed = new URL(trimmed);
    if (ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      return parsed.toString();
    }
    if (BLOCKED_PROTOCOLS.has(parsed.protocol)) {
      return null;
    }
  } catch {
    return null;
  }

  return null;
}

function getSafePageContext() {
  const context = getPageContext();
  const safeUrl = context.url ? toSafeRequestUrl(context.url) : null;
  return {
    ...context,
    url: safeUrl ?? '',
  };
}

export default function AssistantChatbox() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const pageContextRef = useRef<PageContext | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const openTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ChatMessage[];
        if (Array.isArray(parsed)) {
          setMessages(parsed.slice(-MAX_MESSAGES));
        }
      } catch {
        // ignore malformed storage
      }
    }
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_MESSAGES)));
  }, [messages, hasHydrated]);

  useEffect(() => {
    if (!isOpen) return;
    pageContextRef.current = getSafePageContext();
    if (openTimeoutRef.current) {
      clearTimeout(openTimeoutRef.current);
    }
    openTimeoutRef.current = setTimeout(() => inputRef.current?.focus(), 120);
    return () => {
      if (openTimeoutRef.current) {
        clearTimeout(openTimeoutRef.current);
        openTimeoutRef.current = null;
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !hasHydrated) return;
    if (messages.length === 0) {
      setMessages([
        {
          id: createId(),
          role: 'assistant',
          content: WELCOME_MESSAGE,
          createdAt: Date.now(),
        },
      ]);
    }
  }, [isOpen, messages.length, hasHydrated]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  const chatHistory = useMemo(() => {
    return messages
      .filter((message) => message.content.trim())
      .filter((message) => message.content !== WELCOME_MESSAGE)
      .slice(-MAX_MESSAGES)
      .map((message) => ({
        role: message.role,
        content: message.content.trim(),
      }));
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: createId(),
      role: 'user',
      content: input.trim(),
      createdAt: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage].slice(-MAX_MESSAGES));
    setInput('');
    setIsLoading(true);

    const pageContext = getSafePageContext();
    pageContextRef.current = pageContext;

    try {
      const historyForRequest = chatHistory.slice(-(MAX_MESSAGES - 1));
      const response = await apiFetch<{ reply: string }>(
        '/chat',
        {
          method: 'POST',
          body: JSON.stringify({
            messages: [
              ...historyForRequest,
              { role: 'user', content: userMessage.content },
            ],
            pageContext,
          }),
        },
        false,
      );

      const assistantMessage: ChatMessage = {
        id: createId(),
        role: 'assistant',
        content: response.reply || 'Sorry, I could not generate a reply right now.',
        createdAt: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage].slice(-MAX_MESSAGES));
    } catch (error: any) {
      const rawMessage =
        typeof error?.message === 'string'
          ? error.message
          : 'Sorry, something went wrong while contacting the assistant.';
      const friendlyMessage = rawMessage.includes('Cannot POST /api/chat')
        ? 'Chat service is unavailable. Please ensure the server is running with the latest code.'
        : rawMessage;
      setMessages((prev) =>
        [
          ...prev,
          {
            id: createId(),
            role: 'assistant',
            content: friendlyMessage,
            createdAt: Date.now(),
          },
        ].slice(-MAX_MESSAGES),
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-5 left-5 z-50" data-assistant-chatbox>
      <div
        className={cn(
          'pointer-events-none fixed bottom-20 left-5 w-[320px] origin-bottom-left rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] shadow-xl transition-all duration-200 ease-out sm:w-[360px]',
          isOpen
            ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
            : 'translate-y-2 scale-95 opacity-0',
        )}
        id="assistant-chat-panel"
        role="dialog"
        aria-modal="false"
        aria-label="Assistant chat"
        aria-hidden={!isOpen}
      >
        <div className="flex items-center justify-between border-b border-[color:var(--border)] px-4 py-3">
          <div className="flex items-center gap-3">
            <BotAvatar className="h-9 w-9" iconClassName="h-4 w-4" />
            <div>
              <p className="text-sm font-semibold">Trash2Cash AI</p>
              <p className="text-xs text-[color:var(--muted)]">Site-aware help</p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-full border border-transparent px-2 py-1 text-xs text-[color:var(--muted)] transition hover:border-[color:var(--border)] hover:text-[color:var(--foreground)]"
            onClick={() => setIsOpen(false)}
            aria-label="Close chat"
          >
            Close
          </button>
        </div>
        <div className="flex h-[360px] max-h-[70vh] flex-col">
          <div
            ref={listRef}
            className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm"
            aria-live="polite"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex items-start gap-2',
                  message.role === 'user' ? 'justify-end' : 'justify-start',
                )}
              >
                {message.role === 'assistant' && <BotAvatar className="mt-0.5" />}
                <div
                  className={cn(
                    'max-w-[75%] rounded-2xl px-3 py-2 leading-relaxed shadow-sm break-words',
                    message.role === 'user'
                      ? 'bg-[color:var(--brand)] text-white'
                      : 'bg-[color:var(--surface-soft)] text-[color:var(--foreground)]',
                  )}
                >
                  {message.role === 'assistant' ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {message.content}
                    </ReactMarkdown>
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-start gap-2">
                <BotAvatar className="mt-0.5" />
                <div className="rounded-2xl bg-[color:var(--surface-soft)] px-3 py-2 text-xs text-[color:var(--muted)]">
                  Thinking...
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-[color:var(--border)] px-4 py-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                rows={1}
                placeholder="Ask about this page..."
                className="min-h-[44px] flex-1 resize-none rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none transition focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--ring)]"
                aria-label="Type your message"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="rounded-xl bg-[color:var(--brand)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[color:var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Send message"
              >
                Send
              </button>
            </div>
            <p className="mt-2 text-xs text-[color:var(--muted)]">
              Press Enter to send. Shift+Enter for a new line.
            </p>
          </div>
        </div>
      </div>
      <button
        type="button"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--brand)] text-sm font-semibold text-white shadow-lg transition hover:bg-[color:var(--brand-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
        aria-expanded={isOpen}
        aria-controls="assistant-chat-panel"
        aria-label={isOpen ? 'Close assistant chat' : 'Open assistant chat'}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <Bot className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}
