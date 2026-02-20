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
  BookingAssistantDraft,
  ChatLanguage,
  ChatLanguagePreference,
  ChatMode,
  RetrievedKnowledgeChunk,
  StoredChatMessage,
  SuggestedAction,
} from './chat.types';

const DEFAULT_MODEL = 'gemini-2.5-flash';
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
const BOOKING_FORM_ROUTE = '/users/bookings/new';
const BOOKING_TIME_SLOTS = [
  '8:00 AM - 10:00 AM',
  '10:00 AM - 12:00 PM',
  '1:00 PM - 3:00 PM',
  '3:00 PM - 5:00 PM',
  '6:00 PM - 8:00 PM',
] as const;
const PAPER_WEIGHT_RANGES = [
  { label: '1-5 kg', min: 1, max: 5 },
  { label: '5-10 kg', min: 5, max: 10 },
  { label: '10-20 kg', min: 10, max: 20 },
  { label: '20-50 kg', min: 20, max: 50 },
  { label: '50+ kg', min: 50, max: 80 },
] as const;

type BookingDraftField =
  | 'wasteCategory'
  | 'quantityKg'
  | 'weightRangeLabel'
  | 'addressLine1'
  | 'city'
  | 'postalCode'
  | 'phone'
  | 'scheduledDate'
  | 'scheduledTimeSlot'
  | 'specialInstructions';

type BookingAssistantState = {
  active: boolean;
  draft: BookingAssistantDraft;
  awaitingField: BookingDraftField | null;
  askedOptionalSpecialInstructions: boolean;
  readyToPrefill: boolean;
};

type BookingAssistantTurnResult = {
  reply: string;
  state: BookingAssistantState;
  bookingDraft?: BookingAssistantDraft;
  suggestedActions: SuggestedAction[];
  sources: string[];
  calledTools: string[];
};

type ToolContext = {
  blocks: string[];
  sources: string[];
  calledTools: string[];
  suggestedActions: SuggestedAction[];
};

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly buckets = new Map<
    string,
    { count: number; resetAt: number }
  >();
  private readonly windowMs = 60_000;
  private readonly maxRequests = 12;
  private resolvedModel: string | null = null;
  private readonly sessionMemory = new Map<
    string,
    {
      history: StoredChatMessage[];
      language: ChatLanguage;
      bookingAssistant?: BookingAssistantState;
      updatedAt: number;
    }
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
    const sessionKey = this.resolveSessionKey(
      payload.sessionId,
      auth,
      clientIp,
    );
    const existingSession = this.sessionMemory.get(sessionKey);
    const memoryHistory = this.getSessionHistory(sessionKey, payload, question);
    const responseLanguage = this.resolveResponseLanguage(
      payload.preferredLanguage,
      question,
      payload.messages,
      existingSession?.language,
    );

    const bookingTurn = await this.handleBookingAssistantTurn({
      question,
      auth,
      state: existingSession?.bookingAssistant,
      responseLanguage,
    });

    if (bookingTurn) {
      const reply = bookingTurn.reply.trim();
      const nextHistory = [
        ...memoryHistory,
        { role: 'user' as const, content: question },
        { role: 'assistant' as const, content: reply },
      ].slice(-MAX_SESSION_MESSAGES);

      this.sessionMemory.set(sessionKey, {
        history: nextHistory,
        language: responseLanguage,
        bookingAssistant: bookingTurn.state,
        updatedAt: Date.now(),
      });

      return {
        reply,
        mode: 'data' as ChatMode,
        sources: bookingTurn.sources,
        suggestedActions: bookingTurn.suggestedActions,
        toolCalls: bookingTurn.calledTools,
        responseLanguage,
        bookingDraft: bookingTurn.bookingDraft,
      };
    }

    const knowledgeChunks = await this.knowledgeService.search(
      question,
      KNOWLEDGE_TOP_K,
    );

    const dynamicKnowledgeContext =
      await this.collectDynamicKnowledgeContext(question);

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
      bookingAssistant: existingSession?.bookingAssistant,
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

  private createEmptyBookingAssistantState(): BookingAssistantState {
    return {
      active: true,
      draft: {},
      awaitingField: null,
      askedOptionalSpecialInstructions: false,
      readyToPrefill: false,
    };
  }

  private async handleBookingAssistantTurn(params: {
    question: string;
    auth: AuthContext;
    state?: BookingAssistantState;
    responseLanguage: ChatLanguage;
  }): Promise<BookingAssistantTurnResult | null> {
    const question = params.question.trim();
    const q = question.toLowerCase();
    const locale = this.getBookingLocalePack(params.responseLanguage);
    const hasActiveFlow = Boolean(params.state?.active);
    const shouldStart = this.isBookingCreationIntent(q);

    if (!hasActiveFlow && !shouldStart) {
      return null;
    }

    if (hasActiveFlow && this.isBookingAssistantCancelIntent(q)) {
      return {
        reply: locale.cancelledReply,
        state: {
          active: false,
          draft: {},
          awaitingField: null,
          askedOptionalSpecialInstructions: false,
          readyToPrefill: false,
        },
        suggestedActions: [
          { label: locale.actionGoToBookingHistory, href: '/users/bookings' },
        ],
        sources: ['assistant:booking-form-flow'],
        calledTools: [],
      };
    }

    if (!params.auth.isAuthenticated || !params.auth.userId) {
      return {
        reply: locale.signInFirstReply,
        state: {
          active: false,
          draft: {},
          awaitingField: null,
          askedOptionalSpecialInstructions: false,
          readyToPrefill: false,
        },
        suggestedActions: [{ label: locale.actionSignIn, href: '/login' }],
        sources: ['assistant:booking-form-flow'],
        calledTools: [],
      };
    }

    if (params.auth.role !== Role.CUSTOMER) {
      return {
        reply: locale.customerOnlyReply,
        state: {
          active: false,
          draft: {},
          awaitingField: null,
          askedOptionalSpecialInstructions: false,
          readyToPrefill: false,
        },
        suggestedActions: [
          { label: locale.actionGoToBookingHistory, href: '/users/bookings' },
        ],
        sources: ['assistant:booking-form-flow'],
        calledTools: [],
      };
    }

    let state = params.state?.active
      ? {
          ...params.state,
          draft: { ...params.state.draft },
        }
      : this.createEmptyBookingAssistantState();

    if (this.isBookingAssistantResetIntent(q)) {
      state = this.createEmptyBookingAssistantState();
    }

    const sources = ['assistant:booking-form-flow'];
    const calledTools: string[] = [];

    let wasteTypes: Array<{ id: string; name: string; slug?: string | null }> =
      [];
    try {
      const rows = await this.chatTools.getWasteTypesAndRates();
      wasteTypes = (rows ?? []).map((row: any) => ({
        id: String(row.id),
        name: String(row.name),
        slug:
          typeof row.slug === 'string' && row.slug.trim().length > 0
            ? row.slug
            : null,
      }));
      calledTools.push('getWasteTypesAndRates');
      sources.push('db:waste_types_and_rates');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.debug(
        `Booking assistant could not load waste types from DB: ${message}`,
      );
    }

    const extraction = this.extractBookingDraftFromMessage({
      question,
      awaitingField: state.awaitingField,
      currentDraft: state.draft,
      wasteTypes,
    });
    state.draft = {
      ...state.draft,
      ...extraction.patch,
    };
    state.draft = this.applyBookingQuantityDefaults(state.draft);

    const missingFields = this.getMissingBookingFields(state.draft);

    if (
      missingFields.length === 0 &&
      !state.askedOptionalSpecialInstructions &&
      state.awaitingField !== 'specialInstructions'
    ) {
      state.awaitingField = 'specialInstructions';
      state.askedOptionalSpecialInstructions = true;

      const reply = [locale.allRequiredFieldsCaptured, locale.specialInstructionsPrompt].join(
        '\n\n',
      );

      return {
        reply,
        state,
        suggestedActions: [],
        sources,
        calledTools,
      };
    }

    if (
      state.awaitingField === 'specialInstructions' &&
      state.askedOptionalSpecialInstructions &&
      missingFields.length === 0
    ) {
      if (!state.draft.specialInstructions) {
        const normalized = question.trim();
        if (normalized && !this.isSkipSpecialInstructionsIntent(normalized)) {
          state.draft.specialInstructions = normalized;
        } else {
          state.draft.specialInstructions = '';
        }
      }
    }

    const finalMissing = this.getMissingBookingFields(state.draft);

    if (finalMissing.length > 0) {
      const nextField = finalMissing[0];
      state.awaitingField = nextField;
      state.readyToPrefill = false;
      state.active = true;

      const prompt = this.getBookingPromptForField(
        nextField,
        state.draft,
        wasteTypes,
        params.responseLanguage,
      );
      const captured = this.formatBookingCapturedFields(
        state.draft,
        params.responseLanguage,
      );
      const intro = captured
        ? `${locale.capturedSoFarLabel}\n${captured}`
        : locale.collectStepByStepIntro;

      return {
        reply: `${intro}\n\n${prompt}`,
        state,
        suggestedActions: [
          { label: locale.actionOpenBookingForm, href: BOOKING_FORM_ROUTE },
        ],
        sources,
        calledTools,
      };
    }

    state.awaitingField = null;
    state.readyToPrefill = true;
    state.active = false;

    const bookingDraft = this.normalizeBookingDraftForPrefill(state.draft);
    const summary = this.formatBookingDraftSummary(
      bookingDraft,
      params.responseLanguage,
    );

    const reply = [
      locale.prefillReadyTitle,
      locale.reviewSummaryLabel,
      summary,
      '',
      locale.beforeConfirmTitle,
      `- ${locale.beforeConfirmSelectLocation}`,
      `- ${locale.beforeConfirmAcceptTerms}`,
    ].join('\n');

    return {
      reply,
      state,
      bookingDraft,
      suggestedActions: [
        { label: locale.actionOpenPrefilledBookingForm, href: BOOKING_FORM_ROUTE },
      ],
      sources,
      calledTools,
    };
  }

  private isBookingCreationIntent(q: string) {
    const isHowToQuestion =
      /\bhow to\b/.test(q) || /\bhow do i\b/.test(q) || /\bhow can i\b/.test(q);
    if (isHowToQuestion) return false;

    const hasCreationSignal =
      /\b(create|new|book|schedule|arrange|request)\b/.test(q) &&
      /\b(pickup|pick up|collection|collect)\b/.test(q);

    const directPickupSignal =
      /\bpick\s*up\b/.test(q) ||
      /\bbook\s+(a\s+)?pickup\b/.test(q) ||
      /\bnew booking\b/.test(q) ||
      /\bcreate booking\b/.test(q);

    const isLikelyLookup =
      /\b(my bookings|booking history|booking status|pending pickups|show bookings|list bookings)\b/.test(
        q,
      );

    if (isLikelyLookup) return false;
    return hasCreationSignal || directPickupSignal;
  }

  private isBookingAssistantCancelIntent(q: string) {
    return /\b(cancel|stop|exit|never mind|nevermind)\b/.test(q);
  }

  private isBookingAssistantResetIntent(q: string) {
    return /\b(start over|reset|clear)\b/.test(q);
  }

  private isSkipSpecialInstructionsIntent(value: string) {
    return /\b(none|no|skip|nope|nothing)\b/i.test(value.trim());
  }

  private extractBookingDraftFromMessage(params: {
    question: string;
    awaitingField: BookingDraftField | null;
    currentDraft: BookingAssistantDraft;
    wasteTypes: Array<{ id: string; name: string; slug?: string | null }>;
  }) {
    const patch: Partial<BookingAssistantDraft> = {};
    const question = params.question.trim();

    const wasteMatch = this.matchWasteCategoryFromText(
      question,
      params.wasteTypes,
    );
    if (wasteMatch) {
      patch.wasteCategoryId = wasteMatch.id;
      patch.wasteCategoryName = wasteMatch.name;
    }

    const nextDraft = { ...params.currentDraft, ...patch };
    const paperCategory = this.isPaperCategoryName(nextDraft.wasteCategoryName);

    if (paperCategory) {
      const weightRange = this.parseWeightRangeFromText(question);
      if (weightRange) {
        patch.weightRangeLabel = weightRange.label;
        patch.quantityKg = weightRange.min;
      } else {
        const qty = this.parseQuantityKgFromText(question);
        if (qty !== null) {
          const inferredRange = this.getWeightRangeForQuantity(qty);
          patch.weightRangeLabel = inferredRange.label;
          patch.quantityKg = inferredRange.min;
        }
      }
    } else {
      const qty = this.parseQuantityKgFromText(question);
      if (qty !== null) {
        patch.quantityKg = qty;
      }
    }

    const parsedDate = this.parseScheduledDateFromText(question);
    if (parsedDate) {
      patch.scheduledDate = parsedDate;
    }

    const parsedSlot = this.parseTimeSlotFromText(question);
    if (parsedSlot) {
      patch.scheduledTimeSlot = parsedSlot;
    }

    const shouldParsePostalCode = this.shouldParsePostalCodeFromMessage(
      question,
      params.awaitingField,
    );
    if (shouldParsePostalCode) {
      const parsedPostal = this.parsePostalCodeFromText(question);
      if (parsedPostal) {
        patch.postalCode = parsedPostal;
      }
    }

    const parsedPhone = this.parsePhoneFromText(question);
    if (parsedPhone) {
      patch.phone = parsedPhone;
    }

    const parsedCity = this.parseCityFromText(question);
    if (parsedCity) {
      patch.city = parsedCity;
    }

    if (params.awaitingField === 'addressLine1') {
      const address = this.extractAddressLineFromText(question);
      if (address) {
        patch.addressLine1 = address;
      }
    }

    if (params.awaitingField === 'city' && !patch.city) {
      const city = this.cleanSingleLine(question, 80);
      if (city.length >= 2) {
        patch.city = city;
      }
    }

    if (params.awaitingField === 'postalCode' && !patch.postalCode) {
      const postal = question.replace(/\D/g, '');
      if (postal.length >= 4 && postal.length <= 6) {
        patch.postalCode = postal;
      }
    }

    if (params.awaitingField === 'phone' && !patch.phone) {
      const phone = this.normalizePhoneInput(question);
      if (phone) {
        patch.phone = phone;
      }
    }

    if (params.awaitingField === 'specialInstructions') {
      if (this.isSkipSpecialInstructionsIntent(question)) {
        patch.specialInstructions = '';
      } else {
        patch.specialInstructions = this.cleanSingleLine(question, 400);
      }
    }

    if (params.awaitingField === 'scheduledDate' && !patch.scheduledDate) {
      const fallbackDate = this.parseDateFromNumericInput(question);
      if (fallbackDate) {
        patch.scheduledDate = fallbackDate;
      }
    }

    if (
      params.awaitingField === 'scheduledTimeSlot' &&
      !patch.scheduledTimeSlot
    ) {
      const fallbackSlot = this.parseTimeSlotFromText(question);
      if (fallbackSlot) {
        patch.scheduledTimeSlot = fallbackSlot;
      }
    }

    if (params.awaitingField === 'quantityKg' && !patch.quantityKg) {
      const maybeNumber = Number.parseFloat(question);
      if (Number.isFinite(maybeNumber) && maybeNumber > 0) {
        patch.quantityKg = Math.max(0.1, Math.min(500, maybeNumber));
      }
    }

    return { patch };
  }

  private getMissingBookingFields(draft: BookingAssistantDraft) {
    const missing: BookingDraftField[] = [];

    if (!draft.wasteCategoryId) {
      missing.push('wasteCategory');
    }

    if (!draft.addressLine1) missing.push('addressLine1');
    if (!draft.city) missing.push('city');
    if (!draft.postalCode) missing.push('postalCode');
    if (!draft.phone) missing.push('phone');
    if (!draft.scheduledDate) missing.push('scheduledDate');
    if (
      !draft.scheduledTimeSlot ||
      !BOOKING_TIME_SLOTS.includes(
        draft.scheduledTimeSlot as (typeof BOOKING_TIME_SLOTS)[number],
      )
    ) {
      missing.push('scheduledTimeSlot');
    }

    return missing;
  }

  private getBookingLocalePack(language: ChatLanguage) {
    const slotOptions = BOOKING_TIME_SLOTS.map((slot) => `- ${slot}`).join('\n');

    if (language === 'TA') {
      return {
        cancelledReply:
          'பதிவு அமைப்பு ரத்து செய்யப்பட்டது. மீண்டும் தொடங்க "புதிய பதிவு உருவாக்கு" என்று சொல்லுங்கள்.',
        signInFirstReply:
          'பிக்கப் பதிவு செய்ய முதலில் உள்நுழையவும். உள்நுழைந்த பிறகு பதிவு உருவாக்க சொல்லுங்கள்; நான் படிப்படியாக விவரங்களை கேட்கிறேன்.',
        customerOnlyReply:
          'உதவியாளர் மூலம் பதிவு உருவாக்குதல் CUSTOMER கணக்குகளுக்கு மட்டுமே கிடைக்கும். தயவுசெய்து customer கணக்கைப் பயன்படுத்தவும்.',
        allRequiredFieldsCaptured:
          'சரி. படிவத்திற்குத் தேவையான கட்டாய விவரங்கள் அனைத்தும் கிடைத்துவிட்டன.',
        specialInstructionsPrompt:
          'சிறப்பு குறிப்புகள் (விருப்பம்): கேட் கோடு, landmark, அணுகல் குறிப்பு போன்றவற்றை பகிரவும், அல்லது "none" என்று பதிலளிக்கவும்.',
        capturedSoFarLabel: 'இதுவரை பெற்ற விவரங்கள்:',
        collectStepByStepIntro: 'நான் உங்கள் பதிவு விவரங்களை படிப்படியாக சேகரிக்கிறேன்.',
        prefillReadyTitle:
          'சரி. நம் உரையாடலை வைத்து பதிவு விவரங்களை முன்பூர்த்தி செய்துவிட்டேன்.',
        reviewSummaryLabel: 'இந்த சுருக்கத்தை சரிபார்க்கவும்:',
        beforeConfirmTitle: 'உறுதிப்படுத்துவதற்கு முன் படிவத்தில் செய்ய வேண்டியது:',
        beforeConfirmSelectLocation:
          'வரைபடத்தில் pickup இடத்தைத் தேர்வு/உறுதிப்படுத்தவும்.',
        beforeConfirmAcceptTerms: 'விதிமுறைகள் மற்றும் நிபந்தனைகளை ஏற்கவும்.',
        actionGoToBookingHistory: 'பதிவு வரலாற்றுக்கு செல்லவும்',
        actionSignIn: 'உள்நுழையவும்',
        actionOpenBookingForm: 'பதிவு படிவத்தைத் திறக்கவும்',
        actionOpenPrefilledBookingForm:
          'முன்பூர்த்தி செய்யப்பட்ட பதிவு படிவத்தைத் திறக்கவும்',
        promptWasteCategoryWithSamples: (sample: string) =>
          `கழிவு வகைகளை தேர்வு செய்யவும்: எந்த வகையை சேர்க்க வேண்டும்? கிடைக்கும் உதாரணங்கள்: ${sample}.`,
        promptWasteCategory:
          'கழிவு வகைகளை தேர்வு செய்யவும்: எந்த கழிவு வகையை சேர்க்க வேண்டும்?',
        promptWeightRange: [
          'காகித எடை மதிப்பீடு: ஒரு வரம்பைத் தேர்வு செய்யவும்.',
          '- 1-5 kg',
          '- 5-10 kg',
          '- 10-20 kg',
          '- 20-50 kg',
          '- 50+ kg',
        ].join('\n'),
        promptQuantity: (category: string) =>
          `அளவை பதிவு செய்யவும்: ${category} க்கான மதிப்பிடப்பட்ட எடை எத்தனை kg? (உதாரணம்: 6 kg)`,
        promptStreetAddress: 'தெரு முகவரி *: பிக்கப் செய்ய வேண்டிய தெரு முகவரி என்ன?',
        promptCity: 'நகர் *: பிக்கப் இடம் எந்த நகரத்தில் உள்ளது?',
        promptPostalCode: 'ZIP *: அஞ்சல் குறியீடு என்ன?',
        promptPhoneNumber:
          'தொலைபேசி எண் *: பிக்கப் ஒருங்கிணைப்புக்கு எந்த எண்ணை பயன்படுத்த வேண்டும்?',
        promptScheduledDate:
          'தேதியை தேர்வு செய்யவும்: எந்த தேதியில் பிக்கப் வேண்டும்? (உதாரணம்: நாளை அல்லது 2026-02-21)',
        promptScheduledTimeSlot: ['நேர இடைவெளியைத் தேர்வு செய்யவும்:', slotOptions].join(
          '\n',
        ),
        fieldWasteCategory: 'கழிவு வகை',
        fieldStreetAddress: 'தெரு முகவரி',
        fieldCity: 'நகர்',
        fieldPostalCode: 'அஞ்சல் குறியீடு',
        fieldPhoneNumber: 'தொலைபேசி எண்',
        fieldScheduledDate: 'திட்டமிட்ட தேதி',
        fieldTimeSlot: 'நேர இடைவெளி',
        fieldSpecialInstructions: 'சிறப்பு குறிப்புகள்',
      };
    }

    if (language === 'SI') {
      return {
        cancelledReply:
          'වෙන්කිරීම් සැකසුම අවලංගු කළා. නැවත ආරම්භ කිරීමට "නව බුකින් එකක් සාදන්න" කියන්න.',
        signInFirstReply:
          'පිකප් බුකින් එකක් සාදන්න පෙර කරුණාකර පළමුව ලොගින් වන්න. ලොගින් වූ පසු බුකින් එකක් සාදන්න කියන්න; මම පියවරෙන් පියවර තොරතුරු අසමි.',
        customerOnlyReply:
          'assistant මඟින් බුකින් සෑදීම CUSTOMER ගිණුම් සඳහා පමණක් ලබාදේ. කරුණාකර customer ගිණුමක් භාවිතා කරන්න.',
        allRequiredFieldsCaptured:
          'හොඳයි. ෆෝමයට අවශ්‍ය සියලු අනිවාර්ය තොරතුරු මට ලැබුණා.',
        specialInstructionsPrompt:
          'විශේෂ උපදෙස් (විකල්ප): gate code, landmark, access note වැනි දේ දිය හැකිය, නැත්නම් "none" ලෙස පිළිතුරු දෙන්න.',
        capturedSoFarLabel: 'මේ දක්වා ලබාගත් තොරතුරු:',
        collectStepByStepIntro: 'මම ඔබගේ බුකින් තොරතුරු පියවරෙන් පියවර එකතු කරමි.',
        prefillReadyTitle:
          'හොඳයි. අපගේ සංවාදය අනුව බුකින් තොරතුරු පෙර පුරවා ඇත.',
        reviewSummaryLabel: 'කරුණාකර මෙම සාරාංශය පරීක්ෂා කරන්න:',
        beforeConfirmTitle: 'තහවුරු කිරීමට පෙර ෆෝමයෙන් කළ යුතු දේ:',
        beforeConfirmSelectLocation: 'සිතියමෙන් pickup ස්ථානය තෝරා/තහවුරු කරන්න.',
        beforeConfirmAcceptTerms: 'නියම හා කොන්දේසි පිළිගන්න.',
        actionGoToBookingHistory: 'බුකින් ඉතිහාසයට යන්න',
        actionSignIn: 'පිවිසෙන්න',
        actionOpenBookingForm: 'බුකින් ෆෝමය අරින්න',
        actionOpenPrefilledBookingForm: 'පෙර පුරවා ඇති බුකින් ෆෝමය අරින්න',
        promptWasteCategoryWithSamples: (sample: string) =>
          `අපද්‍රව්‍ය වර්ග තෝරන්න: එක් කිරීමට අවශ්‍ය වර්ගය කුමක්ද? ලැබෙන උදාහරණ: ${sample}.`,
        promptWasteCategory:
          'අපද්‍රව්‍ය වර්ග තෝරන්න: එක් කිරීමට අවශ්‍ය අපද්‍රව්‍ය වර්ගය කුමක්ද?',
        promptWeightRange: [
          'කඩදාසි බර ඇස්තමේන්තුව: එක් පරාසයක් තෝරන්න.',
          '- 1-5 kg',
          '- 5-10 kg',
          '- 10-20 kg',
          '- 20-50 kg',
          '- 50+ kg',
        ].join('\n'),
        promptQuantity: (category: string) =>
          `ප්‍රමාණය ඇතුළත් කරන්න: ${category} සඳහා ඇස්තමේන්තු බර කොපමණද? (උදාහරණය: 6 kg)`,
        promptStreetAddress: 'වීදි ලිපිනය *: පිකප් සඳහා වීදි ලිපිනය කුමක්ද?',
        promptCity: 'නගරය *: පිකප් ස්ථානය පිහිටියේ කුමන නගරයේද?',
        promptPostalCode: 'ZIP *: තැපැල් කේතය කුමක්ද?',
        promptPhoneNumber:
          'දුරකථන අංකය *: පිකප් සම්බන්ධීකරණයට භාවිතා කරන අංකය කුමක්ද?',
        promptScheduledDate:
          'දිනය තෝරන්න: පිකප් කිරීමට අවශ්‍ය දිනය කුමක්ද? (උදාහරණය: හෙට හෝ 2026-02-21)',
        promptScheduledTimeSlot: ['වේලා පරාසය තෝරන්න:', slotOptions].join('\n'),
        fieldWasteCategory: 'අපද්‍රව්‍ය වර්ගය',
        fieldStreetAddress: 'වීදි ලිපිනය',
        fieldCity: 'නගරය',
        fieldPostalCode: 'ZIP',
        fieldPhoneNumber: 'දුරකථන අංකය',
        fieldScheduledDate: 'නියමිත දිනය',
        fieldTimeSlot: 'වේලා පරාසය',
        fieldSpecialInstructions: 'විශේෂ උපදෙස්',
      };
    }

    return {
      cancelledReply:
        'Booking setup cancelled. If you want to start again, say: "Create a new booking".',
      signInFirstReply:
        'To create a pickup booking, please sign in first. After signing in, ask me to create a booking and I will collect the same form details step-by-step.',
      customerOnlyReply:
        'Booking creation in assistant is available for CUSTOMER accounts only. Please use a customer account to create pickup bookings.',
      allRequiredFieldsCaptured:
        'Great. I have all required booking fields from the form.',
      specialInstructionsPrompt:
        'Special Instructions (Optional): Please share any pickup notes (gate code, landmark, access note), or reply "none".',
      capturedSoFarLabel: 'Captured so far:',
      collectStepByStepIntro: 'I will collect your booking details step-by-step.',
      prefillReadyTitle:
        'Great. I have prefilled the booking details from our conversation.',
      reviewSummaryLabel: 'Please review this summary:',
      beforeConfirmTitle: 'Next in the form before confirming:',
      beforeConfirmSelectLocation:
        'Select/confirm pickup location on the map.',
      beforeConfirmAcceptTerms: 'Accept Terms and Conditions.',
      actionGoToBookingHistory: 'Go to Booking History',
      actionSignIn: 'Sign in',
      actionOpenBookingForm: 'Open Booking Form',
      actionOpenPrefilledBookingForm: 'Open Prefilled Booking Form',
      promptWasteCategoryWithSamples: (sample: string) =>
        `Select Waste Categories: Which category should I add? Available examples: ${sample}.`,
      promptWasteCategory:
        'Select Waste Categories: Which waste category should I add?',
      promptWeightRange: [
        'Estimate Weight of the Papers: choose one range.',
        '- 1-5 kg',
        '- 5-10 kg',
        '- 10-20 kg',
        '- 20-50 kg',
        '- 50+ kg',
      ].join('\n'),
      promptQuantity: (category: string) =>
        `Enter Quantities: What is the estimated quantity for ${category} in kg? (Example: 6 kg)`,
      promptStreetAddress: 'Street Address *: What is the pickup street address?',
      promptCity: 'City *: Which city is the pickup location in?',
      promptPostalCode: 'ZIP *: What is the postal code?',
      promptPhoneNumber:
        'Phone Number *: What contact number should we use for pickup coordination?',
      promptScheduledDate:
        'Select Date: Which pickup date do you want? (Example: tomorrow or 2026-02-21)',
      promptScheduledTimeSlot: ['Select Time Slot: choose one.', slotOptions].join(
        '\n',
      ),
      fieldWasteCategory: 'Waste category',
      fieldStreetAddress: 'Street Address',
      fieldCity: 'City',
      fieldPostalCode: 'ZIP',
      fieldPhoneNumber: 'Phone Number',
      fieldScheduledDate: 'Scheduled Date',
      fieldTimeSlot: 'Time Slot',
      fieldSpecialInstructions: 'Special Instructions',
    };
  }

  private getBookingPromptForField(
    field: BookingDraftField,
    draft: BookingAssistantDraft,
    wasteTypes: Array<{ id: string; name: string; slug?: string | null }>,
    language: ChatLanguage,
  ) {
    const locale = this.getBookingLocalePack(language);

    if (field === 'wasteCategory') {
      const sample = wasteTypes
        .map((item) => item.name)
        .slice(0, 6)
        .join(', ');
      return sample
        ? locale.promptWasteCategoryWithSamples(sample)
        : locale.promptWasteCategory;
    }

    if (field === 'weightRangeLabel') {
      return locale.promptWeightRange;
    }

    if (field === 'quantityKg') {
      const category = draft.wasteCategoryName ?? 'selected category';
      return locale.promptQuantity(category);
    }

    if (field === 'addressLine1') {
      return locale.promptStreetAddress;
    }

    if (field === 'city') {
      return locale.promptCity;
    }

    if (field === 'postalCode') {
      return locale.promptPostalCode;
    }

    if (field === 'phone') {
      return locale.promptPhoneNumber;
    }

    if (field === 'scheduledDate') {
      return locale.promptScheduledDate;
    }

    if (field === 'scheduledTimeSlot') {
      return locale.promptScheduledTimeSlot;
    }

    return locale.specialInstructionsPrompt;
  }

  private formatBookingCapturedFields(
    draft: BookingAssistantDraft,
    language: ChatLanguage,
  ) {
    const locale = this.getBookingLocalePack(language);
    const lines: string[] = [];

    if (draft.wasteCategoryName) {
      lines.push(`- ${locale.fieldWasteCategory}: ${draft.wasteCategoryName}`);
    }

    if (draft.addressLine1)
      lines.push(`- ${locale.fieldStreetAddress}: ${draft.addressLine1}`);
    if (draft.city) lines.push(`- ${locale.fieldCity}: ${draft.city}`);
    if (draft.postalCode)
      lines.push(`- ${locale.fieldPostalCode}: ${draft.postalCode}`);
    if (draft.phone) lines.push(`- ${locale.fieldPhoneNumber}: ${draft.phone}`);
    if (draft.scheduledDate)
      lines.push(`- ${locale.fieldScheduledDate}: ${draft.scheduledDate}`);
    if (draft.scheduledTimeSlot) {
      lines.push(`- ${locale.fieldTimeSlot}: ${draft.scheduledTimeSlot}`);
    }
    if (draft.specialInstructions) {
      lines.push(
        `- ${locale.fieldSpecialInstructions}: ${draft.specialInstructions}`,
      );
    }

    return lines.join('\n');
  }

  private normalizeBookingDraftForPrefill(draft: BookingAssistantDraft) {
    const normalizedDate = this.parseDateFromNumericInput(
      draft.scheduledDate ?? '',
    );
    const draftWithQuantityDefaults = this.applyBookingQuantityDefaults(draft);

    return {
      wasteCategoryId: draftWithQuantityDefaults.wasteCategoryId,
      wasteCategoryName: draftWithQuantityDefaults.wasteCategoryName,
      quantityKg: draftWithQuantityDefaults.quantityKg,
      weightRangeLabel: draftWithQuantityDefaults.weightRangeLabel,
      addressLine1: draftWithQuantityDefaults.addressLine1,
      city: draftWithQuantityDefaults.city,
      postalCode: draftWithQuantityDefaults.postalCode,
      phone: draftWithQuantityDefaults.phone,
      specialInstructions: draftWithQuantityDefaults.specialInstructions,
      scheduledDate: normalizedDate || draftWithQuantityDefaults.scheduledDate,
      scheduledTimeSlot: draftWithQuantityDefaults.scheduledTimeSlot,
      lat: draftWithQuantityDefaults.lat,
      lng: draftWithQuantityDefaults.lng,
      locationPicked: Boolean(draftWithQuantityDefaults.locationPicked),
    } satisfies BookingAssistantDraft;
  }

  private formatBookingDraftSummary(
    draft: BookingAssistantDraft,
    language: ChatLanguage,
  ) {
    const locale = this.getBookingLocalePack(language);
    const lines: string[] = [];

    lines.push(
      `- ${locale.fieldWasteCategory}: ${draft.wasteCategoryName ?? 'N/A'}`,
    );
    lines.push(
      `- ${locale.fieldStreetAddress}: ${draft.addressLine1 ?? 'N/A'}`,
    );
    lines.push(`- ${locale.fieldCity}: ${draft.city ?? 'N/A'}`);
    lines.push(`- ${locale.fieldPostalCode}: ${draft.postalCode ?? 'N/A'}`);
    lines.push(`- ${locale.fieldPhoneNumber}: ${draft.phone ?? 'N/A'}`);
    lines.push(
      `- ${locale.fieldScheduledDate}: ${draft.scheduledDate ?? 'N/A'}`,
    );
    lines.push(`- ${locale.fieldTimeSlot}: ${draft.scheduledTimeSlot ?? 'N/A'}`);
    if (draft.specialInstructions) {
      lines.push(
        `- ${locale.fieldSpecialInstructions}: ${draft.specialInstructions}`,
      );
    }

    return lines.join('\n');
  }

  private matchWasteCategoryFromText(
    text: string,
    wasteTypes: Array<{ id: string; name: string; slug?: string | null }>,
  ) {
    const q = text.toLowerCase();
    if (!q.trim()) return null;

    const candidates = [...wasteTypes].sort(
      (a, b) => b.name.length - a.name.length,
    );

    for (const item of candidates) {
      const name = item.name.toLowerCase();
      const slug = (item.slug ?? '').toLowerCase();
      const normalizedSlug = slug.replace(/-/g, ' ').trim();

      if (name && q.includes(name)) {
        return { id: item.id, name: item.name };
      }

      if (normalizedSlug && q.includes(normalizedSlug)) {
        return { id: item.id, name: item.name };
      }
    }

    const fallbackKeywords = [
      'plastic',
      'paper',
      'cardboard',
      'metal',
      'glass',
      'e-waste',
      'electronic',
      'organic',
    ];
    const hinted = fallbackKeywords.find((keyword) => q.includes(keyword));
    if (!hinted) return null;

    const fuzzy = candidates.find((item) =>
      item.name.toLowerCase().includes(hinted),
    );
    if (!fuzzy) return null;

    return { id: fuzzy.id, name: fuzzy.name };
  }

  private parseQuantityKgFromText(text: string) {
    const explicit = text.match(
      /(\d+(?:\.\d+)?)\s*(kg|kgs|kilograms?|කිලෝ|kilo|kilos)\b/i,
    );
    if (explicit) {
      const value = Number.parseFloat(explicit[1]);
      if (Number.isFinite(value) && value > 0) {
        return Math.max(0.1, Math.min(500, value));
      }
    }

    return null;
  }

  private parsePostalCodeFromText(text: string) {
    const match = text.match(/\b\d{4,6}\b/);
    return match ? match[0] : null;
  }

  private parsePhoneFromText(text: string) {
    const match = text.match(/(?:\+94|94|0)\s*\d{2}\s*\d{3}\s*\d{4}\b/);
    if (!match) return null;
    return this.normalizePhoneInput(match[0]);
  }

  private normalizePhoneInput(value: string) {
    const raw = value.trim();
    if (!raw) return null;

    const cleaned = raw.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+94') && cleaned.length >= 12) {
      return `+94${cleaned.slice(3, 12)}`;
    }
    if (cleaned.startsWith('94') && cleaned.length >= 11) {
      return `+94${cleaned.slice(2, 11)}`;
    }
    if (cleaned.startsWith('0') && cleaned.length >= 10) {
      return cleaned.slice(0, 10);
    }
    if (cleaned.length >= 9) {
      return cleaned.slice(0, 15);
    }

    return null;
  }

  private parseCityFromText(text: string) {
    const match = text.match(/\bin\s+([A-Za-z][A-Za-z\s.-]{1,50})$/i);
    if (!match) return null;
    return this.cleanSingleLine(match[1], 80);
  }

  private parseScheduledDateFromText(text: string) {
    const q = text.toLowerCase();
    const today = this.getTodayDate();

    if (/\bday after tomorrow\b/.test(q)) {
      return this.formatDateInput(this.addDays(today, 2));
    }
    if (/\btomorrow\b/.test(q)) {
      return this.formatDateInput(this.addDays(today, 1));
    }
    if (/\btoday\b/.test(q)) {
      return this.formatDateInput(today);
    }

    return this.parseDateFromNumericInput(text);
  }

  private parseDateFromNumericInput(text: string) {
    const ymd = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (ymd) {
      const candidate = this.createDateParts(
        Number(ymd[1]),
        Number(ymd[2]),
        Number(ymd[3]),
      );
      if (candidate) return this.formatDateInput(candidate);
    }

    const dmy = text.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/);
    if (dmy) {
      const day = Number(dmy[1]);
      const month = Number(dmy[2]);
      const maybeYear = dmy[3] ? Number(dmy[3]) : new Date().getFullYear();
      const year =
        maybeYear < 100
          ? 2000 + maybeYear
          : Number.isFinite(maybeYear)
            ? maybeYear
            : new Date().getFullYear();
      const candidate = this.createDateParts(year, month, day);
      if (candidate) return this.formatDateInput(candidate);
    }

    return null;
  }

  private parseTimeSlotFromText(text: string) {
    const q = text.toLowerCase();

    const exact = BOOKING_TIME_SLOTS.find((slot) =>
      q.includes(slot.toLowerCase()),
    );
    if (exact) return exact;

    if (/\bmorning\b/.test(q)) return '8:00 AM - 10:00 AM';
    if (/\bnoon\b|\bmidday\b/.test(q)) return '10:00 AM - 12:00 PM';
    if (/\bafternoon\b/.test(q)) return '1:00 PM - 3:00 PM';
    if (/\bevening\b|\bnight\b/.test(q)) return '6:00 PM - 8:00 PM';

    const timeMatch = q.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
    if (timeMatch) {
      const hour12 = Number(timeMatch[1]);
      const ampm = timeMatch[3];
      const hour24 =
        ampm === 'pm' && hour12 !== 12
          ? hour12 + 12
          : ampm === 'am' && hour12 === 12
            ? 0
            : hour12;

      if (hour24 >= 8 && hour24 < 10) return '8:00 AM - 10:00 AM';
      if (hour24 >= 10 && hour24 < 12) return '10:00 AM - 12:00 PM';
      if (hour24 >= 13 && hour24 < 15) return '1:00 PM - 3:00 PM';
      if (hour24 >= 15 && hour24 < 17) return '3:00 PM - 5:00 PM';
      if (hour24 >= 18 && hour24 < 20) return '6:00 PM - 8:00 PM';
    }

    return null;
  }

  private parseWeightRangeFromText(text: string) {
    const q = text.toLowerCase();

    const exact = PAPER_WEIGHT_RANGES.find(
      (range) =>
        q.includes(range.label.toLowerCase().replace(/\s+/g, '')) ||
        q.includes(range.label.toLowerCase()),
    );
    if (exact) return exact;

    const dash = q.match(/\b(\d{1,3})\s*-\s*(\d{1,3})\s*kg?\b/);
    if (dash) {
      const min = Number(dash[1]);
      const max = Number(dash[2]);
      const found = PAPER_WEIGHT_RANGES.find(
        (range) => range.min === min && range.max === max,
      );
      if (found) return found;
    }

    const qty = this.parseQuantityKgFromText(text);
    if (qty !== null) {
      return this.getWeightRangeForQuantity(qty);
    }

    return null;
  }

  private getWeightRangeForQuantity(quantityKg: number) {
    return (
      PAPER_WEIGHT_RANGES.find(
        (range) => quantityKg >= range.min && quantityKg <= range.max,
      ) ?? PAPER_WEIGHT_RANGES[PAPER_WEIGHT_RANGES.length - 1]
    );
  }

  private getWeightRangeByLabel(label?: string) {
    if (!label) return null;
    const normalized = label.toLowerCase().replace(/\s+/g, '');
    return (
      PAPER_WEIGHT_RANGES.find(
        (range) => range.label.toLowerCase().replace(/\s+/g, '') === normalized,
      ) ?? null
    );
  }

  private isPaperCategoryName(value?: string) {
    const lower = (value ?? '').toLowerCase();
    return lower.includes('paper') || lower.includes('cardboard');
  }

  private shouldParsePostalCodeFromMessage(
    message: string,
    awaitingField: BookingDraftField | null,
  ) {
    const hasPostalKeyword =
      /\b(zip|zip code|postal|postal code|postcode)\b/i.test(message);
    if (hasPostalKeyword) {
      return true;
    }

    if (awaitingField === 'phone') return false;

    return (
      awaitingField === null ||
      awaitingField === 'addressLine1' ||
      awaitingField === 'city' ||
      awaitingField === 'postalCode'
    );
  }

  private applyBookingQuantityDefaults(draft: BookingAssistantDraft) {
    const next: BookingAssistantDraft = { ...draft };
    const paperCategory = this.isPaperCategoryName(next.wasteCategoryName);

    if (paperCategory) {
      if (next.weightRangeLabel) {
        const selectedRange = this.getWeightRangeByLabel(next.weightRangeLabel);
        if (!next.quantityKg || next.quantityKg <= 0) {
          next.quantityKg = selectedRange?.min ?? 1;
        }
      } else if (next.quantityKg && next.quantityKg > 0) {
        const inferredRange = this.getWeightRangeForQuantity(next.quantityKg);
        next.weightRangeLabel = inferredRange.label;
        next.quantityKg = inferredRange.min;
      } else {
        next.weightRangeLabel = PAPER_WEIGHT_RANGES[0].label;
        next.quantityKg = PAPER_WEIGHT_RANGES[0].min;
      }
      return next;
    }

    if (!next.quantityKg || next.quantityKg <= 0) {
      next.quantityKg = 1;
    }
    return next;
  }

  private cleanSingleLine(value: string, maxLength: number) {
    return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
  }

  private extractAddressLineFromText(text: string) {
    const normalized = this.cleanSingleLine(text, 160);
    if (!normalized) return null;

    const withoutLeadingLabel = normalized.replace(
      /^(street address|address|pickup address|location)\s*[:\-]?\s*/i,
      '',
    );
    const candidate = this.cleanSingleLine(withoutLeadingLabel, 160);

    // Avoid accepting pure acknowledgements as an address.
    if (/^(yes|ok|okay|sure|done|next|continue)$/i.test(candidate)) {
      return null;
    }

    // Accept short but realistic addresses (e.g. "No 7", "12/A") to avoid
    // blocking the flow at street-address step.
    const hasLetterOrDigit = /[\p{L}\p{N}]/u.test(candidate);
    if (!hasLetterOrDigit || candidate.length < 3) {
      return null;
    }

    return candidate;
  }

  private getTodayDate() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  private addDays(base: Date, days: number) {
    const next = new Date(base);
    next.setDate(next.getDate() + days);
    return next;
  }

  private createDateParts(year: number, month: number, day: number) {
    if (
      !Number.isFinite(year) ||
      !Number.isFinite(month) ||
      !Number.isFinite(day)
    ) {
      return null;
    }

    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }

    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }

  private formatDateInput(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

    if (
      auth.role === Role.DRIVER &&
      /\bunassigned\b|\bnot assigned\b/.test(q)
    ) {
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
        profile.approved === null ? 'N/A' : profile.approved ? 'yes' : 'no'
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
        `  - #${item.id.slice(0, 8)} | ${item.status} | ${new Date(
          item.scheduledDate,
        )
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
          `  - Booking #${String(row.bookingId).slice(0, 8)} | +${row.pointsAwarded} pts | ${new Date(
            row.awardedAt,
          )
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
    const statusEntries = Object.entries(data.countsByStatus ?? {}).sort(
      (a, b) => a[0].localeCompare(b[0]),
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
      const pro = supported.find((entry: any) =>
        /pro/i.test(entry?.name || ''),
      );
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
