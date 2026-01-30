import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Validate a Gemini API key by calling a configurable validation URL.
   * Returns true when the endpoint responds with a 2xx status.
   */
  async validateKey(apiKey?: string): Promise<boolean> {
    const key = apiKey ?? this.config.get<string>('GEMINI_API_KEY');
    if (!key) {
      this.logger.warn('No GEMINI_API_KEY provided');
      return false;
    }

    const url =
      this.config.get<string>('GEMINI_VALIDATION_URL') ||
      'https://api.gemini.ai/v1/models';

    try {
      // choose a fetch implementation compatible with the runtime
      // prefer global fetch (Node 18+), otherwise try undici or node-fetch
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let fetchFn: any = (globalThis as any).fetch;
      if (!fetchFn) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const undici = require('undici');
          fetchFn = undici.fetch;
        } catch (e) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            fetchFn = require('node-fetch');
          } catch (e2) {
            throw new Error(
              'No fetch available. Run on Node 18+ or install undici/node-fetch',
            );
          }
        }
      }

      const res = await fetchFn(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) return true;

      this.logger.warn(
        `Gemini key validation failed: ${res.status} ${res.statusText}`,
      );
      return false;
    } catch (err: any) {
      this.logger.error(
        'Gemini key validation error',
        err?.message ?? err,
        err?.stack ?? undefined,
      );
      return false;
    }
  }

  /**
   * Generate search suggestions using the configured Gemini API.
   * Expects the Gemini API to return a JSON body containing either
   * an array of suggestions or an object with `suggestions` array.
   */
  async generateSuggestions(
    query: string,
    count = 5,
  ): Promise<string[] | null> {
    const key = this.config.get<string>('GEMINI_API_KEY');
    if (!key) return null;

    const url =
      this.config.get<string>('GEMINI_COMPLETIONS_URL') ||
      'https://api.gemini.ai/v1/responses';

    const systemPrompt =
      'You are a search autocomplete engine for the Trash2Cash marketplace. Return exactly ' +
      count +
      ' suggestions as a JSON array of short phrases focused on recyclable/trash items.';

    try {
      // pick a fetch implementation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let fetchFn: any = (globalThis as any).fetch;
      if (!fetchFn) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const undici = require('undici');
          fetchFn = undici.fetch;
        } catch (e) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            fetchFn = require('node-fetch');
          } catch (e2) {
            throw new Error(
              'No fetch available. Run on Node 18+ or install undici/node-fetch',
            );
          }
        }
      }

      const res = await fetchFn(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: systemPrompt + '\nUser input: ' + query,
          max_tokens: 300,
        }),
      });

      if (!res.ok) {
        this.logger.warn(`Gemini generateSuggestions failed: ${res.status}`);
        return null;
      }

      const data = await res.json();

      // Try to extract suggestions from common shapes
      if (Array.isArray(data)) return data.slice(0, count);
      if (Array.isArray(data.suggestions))
        return data.suggestions.slice(0, count);
      if (typeof data.output === 'string') {
        try {
          const parsed = JSON.parse(data.output);
          if (Array.isArray(parsed)) return parsed.slice(0, count);
          if (Array.isArray(parsed.suggestions))
            return parsed.suggestions.slice(0, count);
        } catch (_) {
          // fallthrough
        }
      }

      // Attempt to parse any text fields for a JSON array
      const text = data?.text || data?.output || null;
      if (typeof text === 'string') {
        const m = text.match(/\[[\s\S]*\]/);
        if (m) {
          try {
            const arr = JSON.parse(m[0]);
            if (Array.isArray(arr)) return arr.slice(0, count);
          } catch (_) {
            // ignore
          }
        }
      }

      this.logger.warn(
        'Gemini did not return suggestions in expected format',
        data,
      );
      return null;
    } catch (err: any) {
      this.logger.error(
        'Gemini generateSuggestions error',
        err?.message ?? err,
        err?.stack ?? undefined,
      );
      return null;
    }
  }
}
