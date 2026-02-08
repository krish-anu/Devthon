import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatRequestDto, PageContextDto } from './dto/chat.dto';

const DEFAULT_MODEL = 'gemini-1.5-flash';
const DEFAULT_API_BASE_URL = 'https://generativelanguage.googleapis.com';
const DEFAULT_API_VERSION = 'v1';
const MAX_CONTEXT_CHARS = 8000;
const MAX_HISTORY = 20;

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

  constructor(private readonly config: ConfigService) {}

  async handleChat(payload: ChatRequestDto, clientIp: string) {
    this.assertRateLimit(clientIp);

    if (!payload.messages || payload.messages.length === 0) {
      throw new BadRequestException('messages are required');
    }

    const key = this.config.get<string>('GEMINI_API_KEY');
    if (!key) {
      throw new BadRequestException('GEMINI_API_KEY is not configured');
    }

    const model = this.getConfiguredModel();
    const context = this.normalizeContext(payload.pageContext);
    const systemPrompt = this.buildSystemPrompt(context);

    const history = payload.messages
      .filter((message) => message?.content?.trim())
      .slice(-MAX_HISTORY)
      .map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content.trim() }],
      }));

    const contents = [
      {
        role: 'user',
        parts: [{ text: systemPrompt }],
      },
      ...history,
    ];

    const reply = await this.callGemini({ key, model, contents });
    return { reply };
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

  private buildSystemPrompt(context: {
    url: string;
    title: string;
    metaDescription: string;
    textContent: string;
  }) {
    const urlLine = context.url ? `URL: ${context.url}` : 'URL: (not provided)';
    const titleLine = context.title
      ? `Title: ${context.title}`
      : 'Title: (not provided)';
    const metaLine = context.metaDescription
      ? `Meta description: ${context.metaDescription}`
      : 'Meta description: (not provided)';
    const textLine = context.textContent
      ? `Visible text: ${context.textContent}`
      : 'Visible text: (not provided)';

    return [
      'You are the Trash2Cash website assistant.',
      'Answer using ONLY the page context below.',
      'If the answer is not in the context, say you are not sure and ask a clarifying question.',
      'Do not invent features, policies, pricing, or navigation that are not in the context.',
      'Keep responses concise and helpful.',
      '',
      'Page context:',
      urlLine,
      titleLine,
      metaLine,
      textLine,
    ].join('\n');
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
          maxOutputTokens: 512,
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
