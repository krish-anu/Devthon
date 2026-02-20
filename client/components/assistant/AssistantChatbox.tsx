"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot } from "lucide-react";
import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import { getPageContext, PageContext } from "@/lib/page-context";
import {
  ASSISTANT_BOOKING_DRAFT_KEY,
  AssistantBookingDraft,
  isAssistantBookingDraft,
} from "@/lib/assistant-booking-draft";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "t2c-assistant-chat";
const SESSION_ID_KEY = "t2c-assistant-session-id";
const LANGUAGE_KEY = "t2c-assistant-language";
const MAX_MESSAGES = 20;
type AssistantLanguage = "EN" | "SI" | "TA";

const LANGUAGE_OPTIONS: Array<{
  value: AssistantLanguage;
  label: string;
}> = [
  { value: "EN", label: "English" },
  { value: "SI", label: "සිංහල" },
  { value: "TA", label: "தமிழ்" },
];

const WELCOME_MESSAGES: Record<AssistantLanguage, string> = {
  EN: "Hi! I'm your Trash2Treasure AI assistant. How can I help you?",
  SI: "ආයුබෝවන්! මම Trash2Treasure AI සහායකයා. ඔබට මම කෙසේ උදව් කළ හැකිද?",
  TA: "வணக்கம்! நான் Trash2Treasure AI உதவியாளர். நான் உங்களுக்கு எப்படி உதவலாம்?",
};

const LOGIN_REQUIRED_MESSAGE_BY_LANGUAGE: Record<AssistantLanguage, string> = {
  EN: "Please log in first to create a pickup booking. After login, I will ask the same questions as the booking form and prefill it for you.",
  SI: "පිකප් බුකින් එකක් සෑදීමට පළමුව ලොගින් වන්න. ලොගින් වූ පසු, බුකින් ෆෝමයේම ප්‍රශ්න අසමින් පෙර පුරවන්නම්.",
  TA: "பிக்கப் பதிவு உருவாக்க முதலில் உள்நுழையவும். உள்நுழைந்த பிறகு, பதிவு படிவத்தில் உள்ள அதே கேள்விகளை கேட்டு முன்பூர்த்தி செய்கிறேன்.",
};

const SIGN_IN_LABEL_BY_LANGUAGE: Record<AssistantLanguage, string> = {
  EN: "Sign in",
  SI: "පිවිසෙන්න",
  TA: "உள்நுழையவும்",
};

const QUICK_COMMANDS_BY_LANGUAGE: Record<
  AssistantLanguage,
  Array<{ label: string; prompt: string }>
> = {
  EN: [
    { label: "Book a pickup", prompt: "Create a new pickup booking" },
    { label: "My bookings", prompt: "Show my bookings" },
    { label: "My points", prompt: "Show my points and rewards summary" },
    { label: "Pending pickups", prompt: "Show my pending pickups" },
    { label: "How rewards work", prompt: "Explain how rewards work" },
    {
      label: "Waste types & pricing",
      prompt: "Show waste types and pricing rates",
    },
  ],
  SI: [
    { label: "නව පිකප් වෙන්කරන්න", prompt: "නව පිකප් බුකින් එකක් සාදන්න" },
    { label: "මගේ බුකින්", prompt: "මගේ බුකින් පෙන්වන්න" },
    { label: "මගේ ලකුණු", prompt: "මගේ ලකුණු සහ ත්‍යාග සාරාංශය පෙන්වන්න" },
    { label: "අපේක්ෂිත පිකප්", prompt: "මගේ අපේක්ෂිත පිකප් පෙන්වන්න" },
    { label: "ත්‍යාග ක්‍රමය", prompt: "ත්‍යාග ක්‍රමය ක්‍රියාකරන ආකාරය පැහැදිලි කරන්න" },
    { label: "අපද්‍රව්‍ය සහ මිල", prompt: "අපද්‍රව්‍ය වර්ග සහ මිල ගණන් පෙන්වන්න" },
  ],
  TA: [
    { label: "பிக்கப் பதிவு", prompt: "புதிய பிக்கப் முன்பதிவு உருவாக்கு" },
    { label: "என் முன்பதிவுகள்", prompt: "என் முன்பதிவுகளை காட்டு" },
    { label: "என் புள்ளிகள்", prompt: "என் புள்ளிகள் மற்றும் பரிசு சுருக்கத்தை காட்டு" },
    { label: "நிலுவை பிக்கப்", prompt: "என் நிலுவையில் உள்ள பிக்கப்புகளை காட்டு" },
    { label: "பரிசு எப்படி?", prompt: "பரிசு திட்டம் எப்படி செயல்படுகிறது என்பதை விளக்கு" },
    { label: "கழிவு & விலை", prompt: "கழிவு வகைகள் மற்றும் விலை விவரங்களை காட்டு" },
  ],
};
const WELCOME_MESSAGE_VALUES = new Set(Object.values(WELCOME_MESSAGES));
const BLOCKED_PROTOCOLS = new Set([
  "chrome-extension:",
  "about:",
  "blob:",
  "data:",
  "mailto:",
  "tel:",
  "javascript:",
]);
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

type ChatApiResponse = {
  reply: string;
  mode?: "knowledge" | "data" | "mixed";
  responseLanguage?: AssistantLanguage;
  suggestedActions?: Array<{ label: string; href: string }>;
  bookingDraft?: AssistantBookingDraft;
};

type ChatSuggestedAction = {
  label: string;
  href: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  mode?: "knowledge" | "data" | "mixed";
};

const markdownComponents: Components = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-2 last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-2 list-disc pl-5 last:mb-0">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-2 list-decimal pl-5 last:mb-0">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="mb-1 last:mb-0">{children}</li>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="mb-2 overflow-x-auto rounded-lg bg-black/5 p-2 text-[0.85em]">
      {children}
    </pre>
  ),
  code: ({
    inline,
    children,
  }: {
    inline?: boolean;
    children?: React.ReactNode;
  }) =>
    inline ? (
      <code className="rounded bg-black/5 px-1 py-0.5 text-[0.85em]">
        {children}
      </code>
    ) : (
      <code className="block whitespace-pre-wrap text-[0.85em]">
        {children}
      </code>
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
        "flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--surface-soft)] text-[color:var(--brand)]",
        className,
      )}
      aria-hidden="true"
    >
      <Bot className={cn("h-4 w-4", iconClassName)} />
    </div>
  );
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function isAssistantLanguage(value: string): value is AssistantLanguage {
  return value === "EN" || value === "SI" || value === "TA";
}

function isWelcomeMessage(content: string) {
  return WELCOME_MESSAGE_VALUES.has(content);
}

function stripSourcesFooter(content: string) {
  return content.replace(/\n+Sources:\s*[\s\S]*$/i, "").trim();
}

function hasCorruptedLanguageText(content: string) {
  return /\?{3,}/.test(content) || /(?:Ã|â€|à¶|à®|à¯|à·)/.test(content);
}

function isRelativeUrl(value: string) {
  if (value.startsWith("//")) return false;
  return !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value);
}

function isSafeInternalHref(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) return false;
  if (trimmed.startsWith("//")) return false;
  return true;
}

function isBookingCreationIntent(text: string) {
  const q = text.toLowerCase();
  const isHowToQuestion =
    /\bhow to\b/.test(q) || /\bhow do i\b/.test(q) || /\bhow can i\b/.test(q);
  if (isHowToQuestion) return false;

  const hasCreation =
    /\b(create|new|book|schedule|arrange|request)\b/.test(q) &&
    /\b(pickup|pick up|collection|collect)\b/.test(q);
  const direct =
    /\bbook\s+(a\s+)?pickup\b/.test(q) ||
    /\bcreate booking\b/.test(q) ||
    /\bnew booking\b/.test(q) ||
    /\bpick\s*up\b/.test(q);
  const lookupOnly =
    /\b(my bookings|booking history|booking status|pending pickups|show bookings|list bookings)\b/.test(
      q,
    );

  return !lookupOnly && (hasCreation || direct);
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
    url: safeUrl ?? "",
  };
}

export default function AssistantChatbox() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [languagePreference, setLanguagePreference] =
    useState<AssistantLanguage>("EN");
  const [suggestedActions, setSuggestedActions] = useState<ChatSuggestedAction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const sessionIdRef = useRef<string>("");
  const pageContextRef = useRef<PageContext | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const openTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Pulse state when a new assistant message arrives (shows subtle glow)
  const [newMessagePulse, setNewMessagePulse] = useState(false);
  // Track unread messages when the panel is closed
  const [hasUnread, setHasUnread] = useState(false);
  const prevMessagesCountRef = useRef(messages.length);

  const quickCommands = useMemo(
    () => QUICK_COMMANDS_BY_LANGUAGE[languagePreference],
    [languagePreference],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ChatMessage[];
        if (Array.isArray(parsed)) {
          const hasCorruptedCache = parsed.some(
            (message) =>
              typeof message?.content === "string" &&
              hasCorruptedLanguageText(message.content),
          );
          if (hasCorruptedCache) {
            window.sessionStorage.removeItem(STORAGE_KEY);
          } else {
            setMessages(parsed.slice(-MAX_MESSAGES));
          }
        }
      } catch {
        // ignore malformed storage
      }
    }

    let sessionId = window.sessionStorage.getItem(SESSION_ID_KEY);
    if (!sessionId) {
      sessionId = createId();
      window.sessionStorage.setItem(SESSION_ID_KEY, sessionId);
    }
    sessionIdRef.current = sessionId;

    const storedLanguage = window.sessionStorage.getItem(LANGUAGE_KEY);
    if (storedLanguage && isAssistantLanguage(storedLanguage)) {
      setLanguagePreference(storedLanguage);
    }

    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(messages.slice(-MAX_MESSAGES)),
    );
  }, [messages, hasHydrated]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(LANGUAGE_KEY, languagePreference);
  }, [languagePreference, hasHydrated]);

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
      const welcome: ChatMessage = {
        id: createId(),
        role: "assistant",
        content: WELCOME_MESSAGES[languagePreference],
        createdAt: Date.now(),
      };
      setMessages([welcome]);
    }
  }, [isOpen, messages.length, hasHydrated, languagePreference]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, isLoading]);

  // Detect new assistant messages and animate a subtle glow on the chat list.
  // If the panel is closed, mark as unread to show a ring on the chat button.
  useEffect(() => {
    const prev = prevMessagesCountRef.current;
    const current = messages.length;
    if (current > prev) {
      const last = messages[messages.length - 1];
      if (last?.role === "assistant") {
        if (!isOpen) {
          setHasUnread(true);
        } else {
          setNewMessagePulse(true);
          const t = setTimeout(() => setNewMessagePulse(false), 2200);
          return () => clearTimeout(t);
        }
      }
    }
    prevMessagesCountRef.current = current;
  }, [messages, isOpen]);

  // Clear unread state when the panel is opened by the user
  useEffect(() => {
    if (isOpen) {
      setHasUnread(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current) return;
      // If the clicked element is not inside the container, close the chat
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  const chatHistory = useMemo(() => {
    return messages
      .filter((message) => message.content.trim())
      .filter((message) => !isWelcomeMessage(message.content))
      .slice(-MAX_MESSAGES)
      .map((message) => ({
        role: message.role,
        content:
          message.role === "assistant"
            ? stripSourcesFooter(message.content)
            : message.content.trim(),
      }));
  }, [messages]);

  const sendMessage = async (overrideMessage?: string) => {
    const outgoing = (overrideMessage ?? input).trim();
    if (!outgoing || isLoading) return;

    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: outgoing,
      createdAt: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage].slice(-MAX_MESSAGES));
    setInput("");
    setIsLoading(true);
    setSuggestedActions([]);

    if (isBookingCreationIntent(outgoing) && !user) {
      const assistantMessage: ChatMessage = {
        id: createId(),
        role: "assistant",
        content: LOGIN_REQUIRED_MESSAGE_BY_LANGUAGE[languagePreference],
        createdAt: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage].slice(-MAX_MESSAGES));
      setSuggestedActions([
        { label: SIGN_IN_LABEL_BY_LANGUAGE[languagePreference], href: "/login" },
      ]);
      setIsLoading(false);
      return;
    }

    const pageContext = getSafePageContext();
    pageContextRef.current = pageContext;
    if (!sessionIdRef.current && typeof window !== "undefined") {
      const fallbackSessionId = createId();
      window.sessionStorage.setItem(SESSION_ID_KEY, fallbackSessionId);
      sessionIdRef.current = fallbackSessionId;
    }

    try {
      const historyForRequest = chatHistory.slice(-(MAX_MESSAGES - 1));
      const response = await apiFetch<ChatApiResponse>("/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: [
            ...historyForRequest,
            { role: "user", content: userMessage.content },
          ],
          pageContext,
          currentRoute:
            typeof window !== "undefined" ? window.location.pathname : "",
          roleHint: user?.role ?? "GUEST",
          sessionId: sessionIdRef.current || undefined,
          preferredLanguage: languagePreference,
        }),
      });

      const safeActions = (response.suggestedActions ?? [])
        .filter(
          (action): action is ChatSuggestedAction =>
            Boolean(action?.label) &&
            typeof action.label === "string" &&
            typeof action.href === "string" &&
            isSafeInternalHref(action.href),
        )
        .slice(0, 4);
      setSuggestedActions(safeActions);

      if (
        typeof window !== "undefined" &&
        response.bookingDraft &&
        isAssistantBookingDraft(response.bookingDraft)
      ) {
        window.sessionStorage.setItem(
          ASSISTANT_BOOKING_DRAFT_KEY,
          JSON.stringify(response.bookingDraft),
        );
      }

      const assistantMessage: ChatMessage = {
        id: createId(),
        role: "assistant",
        content: stripSourcesFooter(
          response.reply || "Sorry, I could not generate a reply right now.",
        ),
        mode: response.mode,
        createdAt: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage].slice(-MAX_MESSAGES));
    } catch (error: unknown) {
      const rawMessage =
        error instanceof Error
          ? error.message
          : "Sorry, something went wrong while contacting the assistant.";
      const friendlyMessage = rawMessage.includes("Cannot POST /api/chat")
        ? "Chat service is unavailable. Please ensure the server is running with the latest code."
        : rawMessage;
      const errMsg: ChatMessage = {
        id: createId(),
        role: "assistant",
        content: friendlyMessage,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg].slice(-MAX_MESSAGES));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed bottom-3 right-3 z-500 sm:bottom-5 sm:right-5"
      data-assistant-chatbox
    >
      <div
        className={cn(
          "pointer-events-none fixed bottom-[4.5rem] right-3 left-3 w-auto max-w-[calc(100vw-1.5rem)] origin-bottom-right rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] shadow-xl transition-all duration-200 ease-out sm:bottom-20 sm:right-5 sm:left-auto sm:w-[400px] sm:max-w-none",
          isOpen
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "translate-y-2 scale-95 opacity-0",
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
              <p className="text-sm font-semibold">Trash2Treasure AI</p>
              <p className="text-xs text-[color:var(--muted)]">
                Whole website assistant
              </p>
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
        <div className="flex h-[390px] max-h-[70vh] flex-col sm:h-[430px] sm:max-h-[75vh]">
          <div
            ref={listRef}
            className={cn(
              "flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm assistant-scrollbar",
              newMessagePulse && "assistant-scrollbar-pulse",
            )}
            aria-live="polite"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex items-start gap-2",
                  message.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                {message.role === "assistant" && (
                  <BotAvatar className="mt-0.5" />
                )}
                <div
                  className={cn(
                    "max-w-[82%] rounded-2xl px-3 py-2 leading-relaxed shadow-sm break-words sm:max-w-[75%]",
                    message.role === "user"
                      ? "bg-[color:var(--brand)] text-white"
                      : "bg-[color:var(--surface-soft)] text-[color:var(--foreground)]",
                  )}
                >
                  {message.role === "assistant" ? (
                    <>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={markdownComponents}
                      >
                        {stripSourcesFooter(message.content)}
                      </ReactMarkdown>
                    </>
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
            <div className="mb-2 flex items-center justify-between gap-2">
              <label
                htmlFor="assistant-language"
                className="text-[11px] font-medium text-[color:var(--muted)]"
              >
                Response language
              </label>
              <select
                id="assistant-language"
                value={languagePreference}
                onChange={(event) => {
                  const next = event.target.value;
                  if (isAssistantLanguage(next)) {
                    setLanguagePreference(next);
                  }
                }}
                disabled={isLoading}
                className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-2 py-1 text-[11px] text-[color:var(--foreground)] outline-none transition focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--ring)] disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Response language"
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {quickCommands.map((command) => (
                <button
                  key={command.label}
                  type="button"
                  onClick={() => sendMessage(command.prompt)}
                  disabled={isLoading}
                  className="rounded-full border border-[color:var(--border)] px-2 py-1 text-[11px] text-[color:var(--muted)] transition hover:border-[color:var(--brand)] hover:text-[color:var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {command.label}
                </button>
              ))}
            </div>
            {suggestedActions.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {suggestedActions.map((action) => (
                  <a
                    key={`${action.label}-${action.href}`}
                    href={action.href}
                    className="rounded-full border border-[color:var(--brand)] bg-[color:var(--brand)]/10 px-2 py-1 text-[11px] font-medium text-[color:var(--foreground)] transition hover:bg-[color:var(--brand)]/20"
                    onClick={() => setIsOpen(false)}
                  >
                    {action.label}
                  </a>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                rows={1}
                placeholder="Ask anything..."
                className="min-h-[44px] flex-1 resize-none rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none transition focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--ring)] assistant-input-scrollbar"
                aria-label="Type your message"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => sendMessage()}
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
        className={cn(
          "relative flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--brand)] text-sm font-semibold text-white shadow-lg transition hover:bg-[color:var(--brand-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]",
          !isOpen && "assistant-bounce",
          hasUnread && !isOpen && "assistant-notification",
        )}
        aria-expanded={isOpen}
        aria-controls="assistant-chat-panel"
        aria-label={isOpen ? "Close assistant chat" : "Open assistant chat"}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <Bot className="h-5 w-5" aria-hidden="true" />
        {!isOpen && (
          <span className="assistant-bounce-shadow" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

