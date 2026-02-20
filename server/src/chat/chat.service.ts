
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { BRAND_NAME } from '../config/branding';
import { ChatKnowledgeService } from './chat.knowledge.service';
import { listActionsForRole } from './chat.route-map';
import { ChatToolsService } from './chat.tools.service';
import { ChatRequestDto, PageContextDto } from './dto/chat.dto';
import {
  AuthContext,
  ChatLanguage,
  ChatLanguagePreference,
  ChatMode,
  RetrievedKnowledgeChunk,
  StoredChatMessage,
  SuggestedAction,
} from './chat.types';

const DEFAULT_MODEL = 'gemini-1.5-flash';
const DEFAULT_API_BASE_URL = 'https://generativelanguage.googleapis.com';
const DEFAULT_API_VERSION = 'v1';
const MAX_CONTEXT_CHARS = 8000;
const MAX_HISTORY_MESSAGES = 20;
const MAX_SESSION_TURNS = 10;
const MAX_SESSION_MESSAGES = MAX_SESSION_TURNS * 2;
const SESSION_TTL_MS = 1000 * 60 * 60 * 6;
const KNOWLEDGE_TOP_K = 5;
const CHAT_LANGUAGE_PREFERENCES = new Set<ChatLanguagePreference>([
  'AUTO',
  'EN',
  'SI',
  'TA',
]);
const CHAT_LANGUAGE_CODES = new Set<ChatLanguage>(['EN', 'SI', 'TA']);

const PENDING_STATUSES = new Set(['CREATED', 'ASSIGNED', 'IN_PROGRESS']);

type ToolContext = {
  blocks: string[];
  sources: string[];
  calledTools: string[];
  suggestedActions: SuggestedAction[];
};

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();
  private readonly windowMs = 60_000;
  private readonly maxRequests = 12;
  private resolvedModel: string | null = null;
  private readonly sessionMemory = new Map<
    string,
    { history: StoredChatMessage[]; language: ChatLanguage; updatedAt: number }
  >();

  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly knowledgeService: ChatKnowledgeService,
    private readonly chatTools: ChatToolsService,
  ) {}

  async handleChat(
    payload: ChatRequestDto,
    clientIp: string,
    authHeader?: string,
  ) {
    this.assertRateLimit(clientIp);

    if (!payload.messages || payload.messages.length === 0) {
      throw new BadRequestException('messages are required');
    }

    const key = this.config.get<string>('GEMINI_API_KEY');
    if (!key) {
      throw new BadRequestException('GEMINI_API_KEY is not configured');
    }

    const question = this.extractLatestUserMessage(payload);
    const auth = await this.resolveAuthContext(authHeader);
    const mode = this.determineMode(question);
    const pageContext = this.normalizeContext(payload.pageContext);

    this.cleanupExpiredSessions();
    const sessionKey = this.resolveSessionKey(payload.sessionId, auth, clientIp);
    const existingSession = this.sessionMemory.get(sessionKey);
    const memoryHistory = this.getSessionHistory(sessionKey, payload, question);
    const responseLanguage = this.resolveResponseLanguage(
      payload.preferredLanguage,
      question,
      payload.messages,
      existingSession?.language,
    );

    const knowledgeChunks = await this.knowledgeService.search(
      question,
      KNOWLEDGE_TOP_K,
    );

    const dynamicKnowledgeContext = await this.collectDynamicKnowledgeContext(
      question,
    );

    const dataContext = await this.collectDataToolContext(question, auth, mode);

    const systemPrompt = this.buildSystemPrompt({
      auth,
      mode,
      currentRoute: payload.currentRoute,
      pageContext,
      knowledgeChunks,
      dynamicKnowledgeContext,
      dataContext,
      responseLanguage,
    });

    const conversationHistory = [
      ...memoryHistory,
      { role: 'user' as const, content: question },
    ]
      .slice(-MAX_HISTORY_MESSAGES)
      .map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content.trim() }],
      }));

    const model = this.getConfiguredModel();
    const contents = [
      {
        role: 'user',
        parts: [{ text: systemPrompt }],
      },
      ...conversationHistory,
    ];

    const rawReply = await this.callGemini({ key, model, contents });
    const sources = this.collectSources(
      knowledgeChunks,
      dynamicKnowledgeContext,
      dataContext,
    );
    const reply = rawReply.trim();

    const nextHistory = [
      ...memoryHistory,
      { role: 'user' as const, content: question },
      { role: 'assistant' as const, content: reply },
    ].slice(-MAX_SESSION_MESSAGES);

    this.sessionMemory.set(sessionKey, {
      history: nextHistory,
      language: responseLanguage,
      updatedAt: Date.now(),
    });

    const suggestedActions = this.buildSuggestedActions({
      question,
      role: auth.role,
      currentRoute: payload.currentRoute,
      dynamicKnowledgeContext,
      dataContext,
    });

    return {
      reply,
      mode,
      sources,
      suggestedActions,
      toolCalls: [
        ...dynamicKnowledgeContext.calledTools,
        ...dataContext.calledTools,
      ],
      responseLanguage,
    };
  }

  private normalizeContext(context?: PageContextDto) {
    const url = context?.url?.slice(0, 500) || '';
    const title = context?.title?.slice(0, 200) || '';
    const metaDescription = context?.metaDescription?.slice(0, 500) || '';
    let textContent = context?.textContent || '';
    if (textContent.length > MAX_CONTEXT_CHARS) {
      textContent = textContent.slice(0, MAX_CONTEXT_CHARS);
    }

    return { url, title, metaDescription, textContent };
  }

  private extractLatestUserMessage(payload: ChatRequestDto) {
    for (let index = payload.messages.length - 1; index >= 0; index -= 1) {
      const message = payload.messages[index];
      if (message?.role === 'user' && message?.content?.trim()) {
        return message.content.trim();
      }
    }

    throw new BadRequestException('At least one user message is required');
  }

  private normalizeHistory(messages: ChatRequestDto['messages']) {
    return messages
      .filter(
        (message) =>
          message?.content?.trim() &&
          (message.role === 'user' || message.role === 'assistant'),
      )
      .map((message) => ({
        role: message.role,
        content: message.content.trim(),
      }))
      .slice(-MAX_HISTORY_MESSAGES);
  }

  private getSessionHistory(
    sessionKey: string,
    payload: ChatRequestDto,
    question: string,
  ) {
    const existing = this.sessionMemory.get(sessionKey);
    if (existing) {
      return existing.history.slice(-MAX_SESSION_MESSAGES);
    }

    const incoming = this.normalizeHistory(payload.messages);
    const lastUserIndex = [...incoming]
      .reverse()
      .findIndex(
        (message) => message.role === 'user' && message.content === question,
      );

    if (lastUserIndex < 0) {
      return incoming.slice(-MAX_SESSION_MESSAGES);
    }

    const originalIndex = incoming.length - 1 - lastUserIndex;
    return incoming.slice(0, originalIndex).slice(-MAX_SESSION_MESSAGES);
  }

  private resolveResponseLanguage(
    preferredLanguage: string | undefined,
    question: string,
    messages: ChatRequestDto['messages'],
    sessionLanguage?: ChatLanguage,
  ): ChatLanguage {
    const preference = this.normalizeLanguagePreference(preferredLanguage);
    if (preference !== 'AUTO') {
      return preference;
    }

    const detectedFromQuestion = this.detectLanguageFromText(question);
    if (detectedFromQuestion) {
      return detectedFromQuestion;
    }

    if (sessionLanguage && CHAT_LANGUAGE_CODES.has(sessionLanguage)) {
      return sessionLanguage;
    }

    const detectedFromHistory = this.detectLanguageFromMessages(messages);
    if (detectedFromHistory) {
      return detectedFromHistory;
    }

    return 'EN';
  }

  private normalizeLanguagePreference(value?: string): ChatLanguagePreference {
    const normalized = (value ?? 'AUTO').trim().toUpperCase();
    if (CHAT_LANGUAGE_PREFERENCES.has(normalized as ChatLanguagePreference)) {
      return normalized as ChatLanguagePreference;
    }

    return 'AUTO';
  }

  private detectLanguageFromMessages(messages: ChatRequestDto['messages']) {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role !== 'user' || !message.content?.trim()) {
        continue;
      }

      const detected = this.detectLanguageFromText(message.content);
      if (detected) return detected;
    }

    return null;
  }

  private detectLanguageFromText(text: string): ChatLanguage | null {
    const trimmed = text.trim();
    if (!trimmed) return null;

    const sinhalaChars = this.countMatches(trimmed, /[\u0d80-\u0dff]/g);
    const tamilChars = this.countMatches(trimmed, /[\u0b80-\u0bff]/g);
    const latinWords = this.countMatches(trimmed, /\b[A-Za-z][A-Za-z'-]*\b/g);

    if (sinhalaChars >= 2 || tamilChars >= 2) {
      return sinhalaChars >= tamilChars ? 'SI' : 'TA';
    }

    // Avoid flipping to English for short acknowledgements like "ok".
    if (latinWords >= 3 && sinhalaChars === 0 && tamilChars === 0) {
      return 'EN';
    }

    return null;
  }

  private countMatches(text: string, pattern: RegExp) {
    const matches = text.match(pattern);
    return matches ? matches.length : 0;
  }

  private getLanguageDisplayName(language: ChatLanguage) {
    if (language === 'SI') return 'Sinhala';
    if (language === 'TA') return 'Tamil';
    return 'English';
  }

  private cleanupExpiredSessions() {
    const now = Date.now();
    for (const [key, entry] of this.sessionMemory.entries()) {
      if (entry.updatedAt + SESSION_TTL_MS <= now) {
        this.sessionMemory.delete(key);
      }
    }
  }

  private resolveSessionKey(
    sessionId: string | undefined,
    auth: AuthContext,
    clientIp: string,
  ) {
    const normalizedSessionId = (sessionId ?? '').trim().slice(0, 80);
    const sessionSegment = normalizedSessionId || 'default';

    if (auth.isAuthenticated && auth.userId) {
      return `user:${auth.userId}:${sessionSegment}`;
    }

    const ip = (clientIp || 'unknown').trim();
    return `anon:${normalizedSessionId || ip}`;
  }

  private async resolveAuthContext(authHeader?: string): Promise<AuthContext> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        isAuthenticated: false,
        userId: null,
        role: 'GUEST',
      };
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      return {
        isAuthenticated: false,
        userId: null,
        role: 'GUEST',
      };
    }

    const secret = this.config.get<string>('JWT_ACCESS_SECRET');
    if (!secret) {
      this.logger.warn(
        'JWT_ACCESS_SECRET is not configured; chat auth context is unavailable',
      );
      return {
        isAuthenticated: false,
        userId: null,
        role: 'GUEST',
      };
    }

    try {
      const payload = this.jwtService.verify<{ sub?: string; role?: string }>(
        token,
        { secret },
      );
      const role = this.parseRole(payload.role);
      if (!payload.sub || !role) {
        return {
          isAuthenticated: false,
          userId: null,
          role: 'GUEST',
        };
      }

      return {
        isAuthenticated: true,
        userId: payload.sub,
        role,
      };
    } catch {
      this.logger.debug(
        'Chat request has invalid or expired auth token; treating as guest',
      );
      return {
        isAuthenticated: false,
        userId: null,
        role: 'GUEST',
      };
    }
  }

  private parseRole(role?: string) {
    if (!role) return null;
    const values = Object.values(Role) as string[];
    if (!values.includes(role)) return null;
    return role as Role;
  }

  private determineMode(question: string): ChatMode {
    const q = question.toLowerCase();
    const hasKnowledgeSignals =
      /\b(how|where|what|explain|policy|rule|workflow|lifecycle|pricing|waste types?|roles?|statuses?)\b/.test(
        q,
      );

    const hasPersonalSignal = /\b(my|me|mine|assigned to me)\b/.test(q);
    const hasDataEntitySignal =
      /\b(bookings?|points?|rewards?|notifications?|profile|pending pickups?|summary|counts?|assigned)\b/.test(
        q,
      );
    const hasAdminScopeSignal =
      /\b(all bookings|system summary|dashboard summary|total bookings|unassigned)\b/.test(
        q,
      );

    const hasDataSignals =
      (hasPersonalSignal && hasDataEntitySignal) ||
      hasAdminScopeSignal ||
      /\bmy bookings\b|\bmy points\b|\bpending pickups\b|\bassigned bookings\b/.test(
        q,
      );

    if (hasDataSignals && hasKnowledgeSignals) return 'mixed';
    if (hasDataSignals) return 'data';
    return 'knowledge';
  }

  private async collectDynamicKnowledgeContext(
    question: string,
  ): Promise<ToolContext> {
    const context: ToolContext = {
      blocks: [],
      sources: [],
      calledTools: [],
      suggestedActions: [],
    };

    const q = question.toLowerCase();

    if (/\b(waste types?|pricing|price|rates?)\b/.test(q)) {
      try {
        const wasteTypes = await this.chatTools.getWasteTypesAndRates();
        context.calledTools.push('getWasteTypesAndRates');
        context.sources.push('db:waste_types_and_rates');
        context.blocks.push(this.formatWasteTypes(wasteTypes));
        context.suggestedActions.push({
          label: 'Waste Types & Pricing',
          href: '/admin/waste',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        context.blocks.push(
          `Tool note (getWasteTypesAndRates): data unavailable right now (${message}).`,
        );
      }
    }

    if (
      /\b(reward rules?|how rewards work|points rules?|e-waste bonus|multiplier)\b/.test(
        q,
      )
    ) {
      try {
        const rewardRules = await this.chatTools.getRewardRules();
        context.calledTools.push('getRewardRules');
        context.sources.push('db:reward_rules');
        context.blocks.push(this.formatRewardRules(rewardRules));
        context.suggestedActions.push({
          label: 'How Rewards Work',
          href: '/users/rewards',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        context.blocks.push(
          `Tool note (getRewardRules): data unavailable right now (${message}).`,
        );
      }
    }

    return context;
  }

  private async collectDataToolContext(
    question: string,
    auth: AuthContext,
    mode: ChatMode,
  ): Promise<ToolContext> {
    const context: ToolContext = {
      blocks: [],
      sources: [],
      calledTools: [],
      suggestedActions: [],
    };

    if (mode === 'knowledge') {
      return context;
    }

    const q = question.toLowerCase();
    const executed = new Set<string>();

    const run = async (
      toolName: string,
      runner: () => Promise<unknown>,
      formatter: (data: any) => string,
      source: string,
      action?: SuggestedAction,
    ) => {
      if (executed.has(toolName)) return;
      executed.add(toolName);
      try {
        const data = await runner();
        context.calledTools.push(toolName);
        context.sources.push(source);
        context.blocks.push(formatter(data));
        if (action) {
          context.suggestedActions.push(action);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        context.blocks.push(this.formatToolFailure(toolName, message));
      }
    };

    const asksPrivateData =
      /\b(my|me|mine|assigned to me|my account|my profile)\b/.test(q) ||
      /\b(pending pickups?|assigned bookings?|my bookings|my points|my notifications)\b/.test(
        q,
      );

    if (asksPrivateData && !auth.isAuthenticated) {
      context.blocks.push(
        'Permission check: requester is not authenticated. Personal data tools were not executed.',
      );
      context.suggestedActions.push({ label: 'Sign in', href: '/login' });
      return context;
    }

    const asksAdminSummary =
      /\b(admin booking summary|dashboard summary|all bookings|system summary|total bookings|unassigned|pending pickups across system)\b/.test(
        q,
      );

    if (asksAdminSummary && !this.isAdminRole(auth.role)) {
      context.blocks.push(
        `Permission check: role ${auth.role} cannot access admin-wide booking summaries.`,
      );
      if (auth.role === Role.CUSTOMER) {
        context.suggestedActions.push({
          label: 'Go to Booking History',
          href: '/users/bookings',
        });
      }
      if (auth.role === Role.DRIVER) {
        context.suggestedActions.push({
          label: 'Open Driver Bookings',
          href: '/driver/bookings',
        });
      }
    }

    if (auth.role === Role.DRIVER && /\bunassigned\b|\bnot assigned\b/.test(q)) {
      context.blocks.push(
        'Permission check: drivers can only access bookings assigned to themselves. Unassigned booking details were not returned.',
      );
      context.suggestedActions.push({
        label: 'Open Driver Bookings',
        href: '/driver/bookings',
      });
    }

    if (this.isProfileQuery(q) && auth.isAuthenticated) {
      await run(
        'getCurrentUserProfile',
        () => this.chatTools.getCurrentUserProfile(auth),
        (data) => this.formatProfile(data),
        'tool:getCurrentUserProfile',
      );
    }

    const wantsPending = this.isPendingPickupsQuery(q);
    const wantsBookings = this.isBookingsQuery(q) || wantsPending;

    if (wantsBookings && auth.role === Role.CUSTOMER && auth.userId) {
      await run(
        'getUserBookings',
        () => this.chatTools.getUserBookings(auth.userId!, auth, wantsPending),
        (data) => this.formatUserBookings(data, wantsPending),
        'tool:getUserBookings',
        wantsPending
          ? { label: 'Pending pickups', href: '/users/pending-pickups' }
          : { label: 'Go to Booking History', href: '/users/bookings' },
      );
    }

    if (this.isRewardsQuery(q) && auth.role === Role.CUSTOMER && auth.userId) {
      await run(
        'getUserRewards',
        () => this.chatTools.getUserRewards(auth.userId!, auth),
        (data) => this.formatUserRewards(data),
        'tool:getUserRewards',
        { label: 'View Rewards', href: '/users/rewards' },
      );
    }

    if (this.isNotificationsQuery(q) && auth.isAuthenticated && auth.userId) {
      const href =
        auth.role === Role.DRIVER
          ? '/driver/notifications'
          : auth.role === Role.ADMIN || auth.role === Role.SUPER_ADMIN
            ? '/admin/notifications'
            : '/users/notifications';

      await run(
        'getUserNotifications',
        () => this.chatTools.getUserNotifications(auth.userId!, auth),
        (data) => this.formatNotifications(data),
        'tool:getUserNotifications',
        { label: 'Open Notifications', href },
      );
    }

    if (
      (this.isAssignedBookingsQuery(q) ||
        (wantsBookings && auth.role === Role.DRIVER)) &&
      auth.role === Role.DRIVER &&
      auth.userId
    ) {
      await run(
        'getDriverAssignedBookings',
        () => this.chatTools.getDriverAssignedBookings(auth.userId!, auth),
        (data) => this.formatDriverBookings(data, wantsPending),
        'tool:getDriverAssignedBookings',
        { label: 'Open Driver Bookings', href: '/driver/bookings' },
      );
    }

    if (
      (asksAdminSummary || (wantsPending && this.isAdminRole(auth.role))) &&
      this.isAdminRole(auth.role)
    ) {
      await run(
        'getAdminBookingSummary',
        () => this.chatTools.getAdminBookingSummary(auth),
        (data) => this.formatAdminSummary(data),
        'tool:getAdminBookingSummary',
        { label: 'Open Admin Bookings', href: '/admin/bookings' },
      );
    }

    return context;
  }

  private formatToolFailure(toolName: string, message: string) {
    const lower = message.toLowerCase();
    if (
      lower.includes('authentication required') ||
      lower.includes('unauthorized')
    ) {
      return `Tool ${toolName}: unavailable because the user is not authenticated.`;
    }
    if (lower.includes('forbidden')) {
      return `Tool ${toolName}: blocked by role or permission policy.`;
    }

    return `Tool ${toolName}: unavailable (${message}).`;
  }

  private formatProfile(profile: {
    role: string;
    fullName: string | null;
    email: string;
    phone: string | null;
    totalPoints: number | null;
    approved: boolean | null;
  }) {
    return [
      'Tool output: current user profile',
      `- Role: ${profile.role}`,
      `- Name: ${profile.fullName ?? 'Unknown'}`,
      `- Email: ${profile.email}`,
      `- Phone: ${profile.phone ?? 'Not set'}`,
      `- Total points (profile): ${profile.totalPoints ?? 'N/A'}`,
      `- Approved: ${
        profile.approved === null
          ? 'N/A'
          : profile.approved
            ? 'yes'
            : 'no'
      }`,
    ].join('\n');
  }

  private formatUserBookings(data: any, pendingOnly: boolean) {
    const rows = (data.items ?? []).slice(0, 8);
    const title = pendingOnly
      ? 'Tool output: pending user pickups'
      : 'Tool output: user bookings';

    const lines = [
      title,
      `- Total returned: ${rows.length}`,
      `- Pending pickups (all): ${data.pendingCount ?? 0}`,
    ];

    if (rows.length === 0) {
      lines.push('- No bookings found for this scope.');
      return lines.join('\n');
    }

    lines.push('- Recent items:');
    for (const item of rows) {
      lines.push(
        `  - #${item.id.slice(0, 8)} | ${item.status} | ${new Date(item.scheduledDate)
          .toISOString()
          .slice(0, 10)} ${item.scheduledTimeSlot} | ${item.wasteCategory}`,
      );
    }

    return lines.join('\n');
  }

  private formatUserRewards(data: any) {
    const recent = (data.recentPointsTransactions ?? []).slice(0, 5);
    const lines = [
      'Tool output: user rewards',
      `- Total points: ${data.totalPoints ?? 0}`,
      `- Points this month: ${data.monthPoints ?? 0}`,
      `- Month range: ${data.monthRange?.yearMonth ?? 'N/A'}`,
    ];

    if (recent.length > 0) {
      lines.push('- Recent reward transactions:');
      for (const row of recent) {
        lines.push(
          `  - Booking #${String(row.bookingId).slice(0, 8)} | +${row.pointsAwarded} pts | ${new Date(row.awardedAt)
            .toISOString()
            .slice(0, 10)}`,
        );
      }
    }

    return lines.join('\n');
  }

  private formatNotifications(data: any) {
    const items = (data.items ?? []).slice(0, 8);
    const lines = [
      'Tool output: notifications',
      `- Unread count: ${data.unreadCount ?? 0}`,
      `- Recent items: ${items.length}`,
    ];

    for (const item of items) {
      lines.push(
        `  - [${item.level}] ${item.title} (${item.isRead ? 'read' : 'unread'})`,
      );
    }

    return lines.join('\n');
  }

  private formatDriverBookings(data: any, pendingOnly: boolean) {
    const items = (data.items ?? []).filter((item: any) => {
      if (!pendingOnly) return true;
      return PENDING_STATUSES.has(item.status);
    });

    const top = items.slice(0, 10);
    const lines = [
      pendingOnly
        ? 'Tool output: driver pending assigned bookings'
        : 'Tool output: driver assigned bookings',
      `- Total assigned: ${data.total ?? 0}`,
      `- Active count: ${data.activeCount ?? 0}`,
      `- Returned rows: ${top.length}`,
    ];

    for (const item of top) {
      lines.push(
        `  - #${item.id.slice(0, 8)} | ${item.status} | ${item.city} | ${item.wasteCategory}`,
      );
    }

    return lines.join('\n');
  }

  private formatAdminSummary(data: any) {
    const statusEntries = Object.entries(data.countsByStatus ?? {}).sort((a, b) =>
      a[0].localeCompare(b[0]),
    );

    const lines = [
      'Tool output: admin booking summary (counts only)',
      `- Total bookings: ${data.totalBookings ?? 0}`,
      `- Pending pickups: ${data.pendingPickups ?? 0}`,
      `- Unassigned bookings: ${data.unassignedBookings ?? 0}`,
    ];

    if (statusEntries.length > 0) {
      lines.push('- Counts by status:');
      for (const [status, count] of statusEntries) {
        lines.push(`  - ${status}: ${count}`);
      }
    }

    return lines.join('\n');
  }

  private formatWasteTypes(wasteTypes: any[]) {
    const top = (wasteTypes ?? []).slice(0, 12);
    const lines = [
      'Tool output: waste types and rates from database',
      `- Active categories: ${wasteTypes?.length ?? 0}`,
      '- Sample rates (LKR/kg):',
    ];

    for (const item of top) {
      const min = item.minPriceLkrPerKg ?? 'N/A';
      const max = item.maxPriceLkrPerKg ?? 'N/A';
      const mid = item.ratePerKg ?? 'N/A';
      lines.push(
        `  - ${item.name} (${item.slug}): min=${min}, max=${max}, midpoint=${mid}`,
      );
    }

    return lines.join('\n');
  }

  private formatRewardRules(rules: any) {
    return [
      'Tool output: reward rules configuration',
      `- Plastic rate: ${rules.baseRates?.plastic ?? 'N/A'} pts/kg`,
      `- Metal rate: ${rules.baseRates?.metal ?? 'N/A'} pts/kg`,
      `- E-waste bonus: +${rules.eWasteBonus ?? 'N/A'} points`,
      `- Weekly multiplier: ${rules.multipliers?.weeklyStreak ?? 'N/A'}x`,
      `- First booking multiplier: ${rules.multipliers?.firstBooking ?? 'N/A'}x`,
      `- Standard multiplier: ${rules.multipliers?.standard ?? 'N/A'}x`,
      `- Multiplier policy: ${rules.multiplierPolicy ?? 'N/A'}`,
      `- Award condition: ${rules.awardCondition ?? 'N/A'}`,
      `- Formula: ${rules.formula ?? 'N/A'}`,
    ].join('\n');
  }

  private buildSystemPrompt(params: {
    auth: AuthContext;
    mode: ChatMode;
    responseLanguage: ChatLanguage;
    currentRoute?: string;
    pageContext: {
      url: string;
      title: string;
      metaDescription: string;
      textContent: string;
    };
    knowledgeChunks: RetrievedKnowledgeChunk[];
    dynamicKnowledgeContext: ToolContext;
    dataContext: ToolContext;
  }) {
    const { auth, mode, currentRoute, pageContext, knowledgeChunks } = params;

    const knowledgeBlock = knowledgeChunks.length
      ? knowledgeChunks
          .map(
            (chunk, index) =>
              `[K${index + 1}] Source: ${chunk.sourceFile} > ${chunk.section}\n${chunk.text}`,
          )
          .join('\n\n')
      : 'No knowledge chunks retrieved.';

    const dynamicBlock = params.dynamicKnowledgeContext.blocks.length
      ? params.dynamicKnowledgeContext.blocks.join('\n\n')
      : 'No dynamic DB knowledge context used.';

    const dataBlock = params.dataContext.blocks.length
      ? params.dataContext.blocks.join('\n\n')
      : 'No private data tools executed for this request.';

    const routeLine = currentRoute?.trim() || '(not provided)';
    const roleLine = auth.isAuthenticated ? auth.role : 'GUEST';
    const responseLanguageName = this.getLanguageDisplayName(
      params.responseLanguage,
    );

    return [
      `You are the ${BRAND_NAME} Whole Website Assistant.`,
      'Answer using the whole-website knowledge context and tool outputs below, not only current-page text.',
      '',
      'Hard rules:',
      '1) Role privacy is strict. Never reveal private data across users or roles.',
      '2) Tool outputs are authoritative for personal/account data.',
      '3) If data is unavailable, missing, or restricted, say that clearly and give the safest next step.',
      '4) Do not hallucinate features, rules, prices, statuses, or metrics.',
      '5) When using knowledge snippets, cite source names inline like "From rewards.md > Rewards Rules".',
      '6) Ask follow-up questions only when required to proceed safely.',
      '7) Respond in the requested language while preserving system constants.',
      '',
      'Language rules:',
      `- Primary response language: ${responseLanguageName} (${params.responseLanguage}).`,
      '- If the user explicitly asks to switch language, follow that request.',
      '- Keep route paths, booking status enums, IDs, and currency symbols unchanged.',
      '- Do not transliterate unless the user asks for transliteration.',
      '',
      'Requester context:',
      `- Authenticated: ${auth.isAuthenticated ? 'yes' : 'no'}`,
      `- Role: ${roleLine}`,
      `- User ID: ${auth.userId ?? '(none)'}`,
      `- Current route: ${routeLine}`,
      `- Chat mode: ${mode}`,
      '',
      'Current page context (supplemental only):',
      `- URL: ${pageContext.url || '(not provided)'}`,
      `- Title: ${pageContext.title || '(not provided)'}`,
      `- Meta description: ${pageContext.metaDescription || '(not provided)'}`,
      `- Visible text excerpt: ${pageContext.textContent || '(not provided)'}`,
      '',
      'Knowledge base snippets:',
      knowledgeBlock,
      '',
      'Dynamic DB knowledge snippets:',
      dynamicBlock,
      '',
      'Private data tool outputs:',
      dataBlock,
      '',
      'Response style:',
      '- Be concise and practical.',
      '- If refusing data access, explain scope and offer an allowed route.',
      '- Include deep-link route hints when helpful.',
    ].join('\n');
  }

  private collectSources(
    knowledgeChunks: RetrievedKnowledgeChunk[],
    dynamicKnowledgeContext: ToolContext,
    dataContext: ToolContext,
  ) {
    const known = knowledgeChunks.map(
      (chunk) => `${chunk.sourceFile} > ${chunk.section}`,
    );

    const all = [
      ...known,
      ...dynamicKnowledgeContext.sources,
      ...dataContext.sources,
    ];
    return [...new Set(all)].slice(0, 6);
  }

  private buildSuggestedActions(params: {
    question: string;
    role: AuthContext['role'];
    currentRoute?: string;
    dynamicKnowledgeContext: ToolContext;
    dataContext: ToolContext;
  }) {
    const actions: SuggestedAction[] = [];

    const append = (action: SuggestedAction | null) => {
      if (!action) return;
      if (!action.href.startsWith('/')) return;
      if (action.href.startsWith('//')) return;
      actions.push(action);
    };

    for (const action of params.dataContext.suggestedActions) {
      append(action);
    }
    for (const action of params.dynamicKnowledgeContext.suggestedActions) {
      append(action);
    }

    const q = params.question.toLowerCase();

    if (this.isBookingsQuery(q) && params.role === Role.CUSTOMER) {
      append({ label: 'Go to Booking History', href: '/users/bookings' });
    }

    if (this.isRewardsQuery(q) && params.role === Role.CUSTOMER) {
      append({ label: 'View Rewards', href: '/users/rewards' });
    }

    if (this.isPendingPickupsQuery(q)) {
      if (params.role === Role.CUSTOMER) {
        append({ label: 'Pending pickups', href: '/users/pending-pickups' });
      } else if (params.role === Role.DRIVER) {
        append({ label: 'Open Driver Bookings', href: '/driver/bookings' });
      } else if (this.isAdminRole(params.role)) {
        append({ label: 'Open Admin Bookings', href: '/admin/bookings' });
      }
    }

    if (this.isNotificationsQuery(q)) {
      if (params.role === Role.DRIVER) {
        append({ label: 'Open Notifications', href: '/driver/notifications' });
      } else if (this.isAdminRole(params.role)) {
        append({ label: 'Open Notifications', href: '/admin/notifications' });
      } else {
        append({ label: 'Open Notifications', href: '/users/notifications' });
      }
    }

    if (/\b(waste|pricing|rate|category)\b/.test(q)) {
      append(
        this.isAdminRole(params.role)
          ? { label: 'Open Waste Management', href: '/admin/waste' }
          : { label: 'Book a pickup', href: '/users/bookings/new' },
      );
    }

    if (actions.length === 0) {
      const defaults = listActionsForRole(params.role, 4);
      for (const action of defaults) {
        append(action);
      }
    }

    const currentRoute = (params.currentRoute ?? '').trim();
    const deduped = new Map<string, SuggestedAction>();
    for (const action of actions) {
      if (currentRoute && action.href === currentRoute) continue;
      const key = `${action.label}|${action.href}`;
      if (!deduped.has(key)) {
        deduped.set(key, action);
      }
    }

    return [...deduped.values()].slice(0, 6);
  }

  private isBookingsQuery(q: string) {
    return /\b(bookings?|booking status|booking history)\b/.test(q);
  }

  private isRewardsQuery(q: string) {
    return /\b(my points|points balance|rewards?|how rewards work)\b/.test(q);
  }

  private isNotificationsQuery(q: string) {
    return /\bnotifications?\b/.test(q);
  }

  private isPendingPickupsQuery(q: string) {
    return /\bpending pickups?\b/.test(q);
  }

  private isAssignedBookingsQuery(q: string) {
    return /\bassigned bookings?\b|\bbookings assigned\b/.test(q);
  }

  private isProfileQuery(q: string) {
    return /\b(my profile|my account|who am i|current user)\b/.test(q);
  }

  private isAdminRole(role: AuthContext['role']) {
    return role === Role.ADMIN || role === Role.SUPER_ADMIN;
  }

  private async callGemini({
    key,
    model,
    contents,
  }: {
    key: string;
    model: string;
    contents: Array<{ role: string; parts: Array<{ text: string }> }>;
  }) {
    try {
      const fetchFn = await this.getFetch();
      const baseUrl = this.getApiBaseUrl();
      const apiVersion = this.getApiVersion();
      const primaryModel = this.normalizeModelName(model);
      let activeModel = this.resolvedModel ?? primaryModel;

      let response = await this.postGenerateContent({
        fetchFn,
        baseUrl,
        apiVersion,
        key,
        model: activeModel,
        contents,
      });

      if (!response.ok && response.status === 404) {
        const resolved = await this.resolveSupportedModel({
          fetchFn,
          baseUrl,
          apiVersion,
          key,
        });
        if (resolved && resolved !== activeModel) {
          activeModel = resolved;
          response = await this.postGenerateContent({
            fetchFn,
            baseUrl,
            apiVersion,
            key,
            model: activeModel,
            contents,
          });
          if (response.ok) {
            this.resolvedModel = resolved;
          }
        }
      }

      if (!response.ok) {
        const { detail, rawText } = await this.readErrorDetail(response);
        this.logger.warn(
          `Gemini request failed: ${response.status} ${rawText}`,
        );
        throw new BadRequestException(
          detail ? `Gemini request failed: ${detail}` : 'Gemini request failed',
        );
      }

      const data = await response.json();
      const reply =
        data?.candidates?.[0]?.content?.parts
          ?.map((part: any) => part?.text)
          .filter(Boolean)
          .join('') ||
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        data?.text ||
        '';

      if (!reply) {
        throw new BadRequestException('Gemini returned an empty response');
      }

      return reply;
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        'Gemini request error',
        error?.message ?? error,
        error?.stack ?? undefined,
      );
      throw new BadRequestException('Gemini request failed');
    }
  }

  private getConfiguredModel() {
    const model = this.config.get<string>('GEMINI_MODEL') || DEFAULT_MODEL;
    return this.normalizeModelName(model);
  }

  private getApiBaseUrl() {
    const baseUrl =
      this.config.get<string>('GEMINI_API_BASE_URL') || DEFAULT_API_BASE_URL;
    return baseUrl.replace(/\/+$/, '');
  }

  private getApiVersion() {
    return this.config.get<string>('GEMINI_API_VERSION') || DEFAULT_API_VERSION;
  }

  private normalizeModelName(model: string) {
    return model.replace(/^models\//, '');
  }

  private async postGenerateContent({
    fetchFn,
    baseUrl,
    apiVersion,
    key,
    model,
    contents,
  }: {
    fetchFn: any;
    baseUrl: string;
    apiVersion: string;
    key: string;
    model: string;
    contents: Array<{ role: string; parts: Array<{ text: string }> }>;
  }) {
    const url = `${baseUrl}/${apiVersion}/models/${model}:generateContent?key=${key}`;
    return fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 640,
        },
      }),
    });
  }

  private async resolveSupportedModel({
    fetchFn,
    baseUrl,
    apiVersion,
    key,
  }: {
    fetchFn: any;
    baseUrl: string;
    apiVersion: string;
    key: string;
  }) {
    try {
      const url = `${baseUrl}/${apiVersion}/models?key=${key}`;
      const response = await fetchFn(url, { method: 'GET' });
      if (!response.ok) return null;
      const data = await response.json();
      const models = Array.isArray(data?.models) ? data.models : [];
      const supported = models.filter((entry: any) =>
        Array.isArray(entry?.supportedGenerationMethods)
          ? entry.supportedGenerationMethods.includes('generateContent')
          : false,
      );
      if (supported.length === 0) return null;
      const flash = supported.find((entry: any) =>
        /flash/i.test(entry?.name || ''),
      );
      const pro = supported.find((entry: any) => /pro/i.test(entry?.name || ''));
      const pick = flash || pro || supported[0];
      return pick?.name ? this.normalizeModelName(pick.name) : null;
    } catch (error: any) {
      this.logger.warn(
        'Gemini model discovery failed',
        error?.message ?? error,
      );
      return null;
    }
  }

  private async readErrorDetail(response: any) {
    const rawText = await response.text();
    let detail = '';
    try {
      const parsed = JSON.parse(rawText);
      detail =
        parsed?.error?.message || parsed?.error?.status || parsed?.message;
    } catch (_) {
      // ignore parse errors
    }
    return { detail, rawText };
  }

  private async getFetch() {
    let fetchFn: any = (globalThis as any).fetch;
    if (!fetchFn) {
      try {
        const undici = require('undici');
        fetchFn = undici.fetch;
      } catch (e) {
        try {
          fetchFn = require('node-fetch');
        } catch (e2) {
          throw new Error(
            'No fetch available. Run on Node 18+ or install undici/node-fetch',
          );
        }
      }
    }
    return fetchFn;
  }

  private assertRateLimit(clientIp: string) {
    const ip = clientIp || 'unknown';
    const now = Date.now();
    const existing = this.buckets.get(ip);

    if (!existing || existing.resetAt <= now) {
      this.buckets.set(ip, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return;
    }

    existing.count += 1;

    if (existing.count > this.maxRequests) {
      throw new HttpException(
        'Too many chat requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.buckets.set(ip, existing);
  }
}

