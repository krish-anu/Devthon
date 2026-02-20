import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type ScreeningVerdict =
  | 'MATCHING_WASTE'
  | 'WASTE_BUT_DIFFERENT'
  | 'NON_WASTE'
  | 'UNCERTAIN';

export type BookingImageScreeningResult = {
  imageUrl: string;
  isWaste: boolean;
  verdict: ScreeningVerdict;
  detectedObject: string;
  confidence: number;
  reason: string;
  verdictSource: 'model' | 'fallback';
};

export type ScreenImagesOptions = {
  expectedWasteCategory?: string | null;
};

type GeminiScreeningResponse = {
  verdict?: unknown;
  isWaste?: unknown;
  detectedObject?: unknown;
  confidence?: unknown;
  reason?: unknown;
};

const DEFAULT_MODEL = 'gemini-2.0-flash';
const DEFAULT_API_BASE_URL = 'https://generativelanguage.googleapis.com';
const DEFAULT_API_VERSION = 'v1beta';
const DEFAULT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;

@Injectable()
export class BookingImageScreeningService {
  private readonly logger = new Logger(BookingImageScreeningService.name);
  private missingApiKeyWarned = false;

  constructor(private readonly config: ConfigService) {}

  async screenImages(
    imageUrls: string[],
    options: ScreenImagesOptions = {},
  ): Promise<BookingImageScreeningResult[]> {
    const uniqueUrls = [...new Set(imageUrls.filter(Boolean))];
    if (uniqueUrls.length === 0) return [];

    const results = await Promise.all(
      uniqueUrls.map(async (imageUrl) => this.screenImage(imageUrl, options)),
    );

    return results.filter((item): item is BookingImageScreeningResult =>
      Boolean(item),
    );
  }

  private async screenImage(
    imageUrl: string,
    options: ScreenImagesOptions,
  ): Promise<BookingImageScreeningResult | null> {
    if (!this.isScreeningEnabled()) {
      return null;
    }

    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      if (!this.missingApiKeyWarned) {
        this.logger.warn(
          'Skipping booking image screening because GEMINI_API_KEY is not configured.',
        );
        this.missingApiKeyWarned = true;
      }
      return null;
    }

    try {
      const imagePayload = await this.readImagePayload(imageUrl);
      if (!imagePayload) return null;

      const responseText = await this.callGemini({
        apiKey,
        imageBase64: imagePayload.base64Data,
        mimeType: imagePayload.mimeType,
        expectedWasteCategory: options.expectedWasteCategory,
      });

      const parsed = this.parseGeminiResponse(
        responseText,
        options.expectedWasteCategory,
      );
      return {
        imageUrl,
        isWaste: this.isWasteVerdict(parsed.verdict),
        verdict: parsed.verdict,
        detectedObject: parsed.detectedObject,
        confidence: parsed.confidence,
        reason: parsed.reason,
        verdictSource: 'model',
      };
    } catch (error: any) {
      const message =
        error instanceof Error ? error.message : String(error ?? 'unknown');
      this.logger.warn(`Failed to screen image "${imageUrl}": ${message}`);
      return {
        imageUrl,
        isWaste: true,
        verdict: 'UNCERTAIN',
        detectedObject: 'unverified image',
        confidence: 0,
        reason: `Vision check failed: ${message.slice(0, 180)}`,
        verdictSource: 'fallback',
      };
    }
  }

  private isWasteVerdict(verdict: ScreeningVerdict) {
    return verdict === 'MATCHING_WASTE' || verdict === 'WASTE_BUT_DIFFERENT';
  }

  private isScreeningEnabled() {
    const rawFlag = this.config.get<string>('BOOKING_IMAGE_VISION_ENABLED');
    if (!rawFlag) return true;
    return !['false', '0', 'off', 'no'].includes(rawFlag.toLowerCase());
  }

  private getMaxImageBytes() {
    const configured = Number.parseInt(
      this.config.get<string>('BOOKING_IMAGE_VISION_MAX_IMAGE_BYTES') ?? '',
      10,
    );
    return Number.isFinite(configured) && configured > 0
      ? configured
      : DEFAULT_MAX_IMAGE_BYTES;
  }

  private getModel() {
    return (
      this.config.get<string>('BOOKING_IMAGE_VISION_MODEL') ||
      this.config.get<string>('GEMINI_MODEL') ||
      DEFAULT_MODEL
    ).replace(/^models\//, '');
  }

  private getApiBaseUrl() {
    const baseUrl =
      this.config.get<string>('GEMINI_API_BASE_URL') || DEFAULT_API_BASE_URL;
    return baseUrl.replace(/\/+$/, '');
  }

  private getApiVersion() {
    return this.config.get<string>('GEMINI_API_VERSION') || DEFAULT_API_VERSION;
  }

  private async readImagePayload(imageUrl: string): Promise<{
    mimeType: string;
    base64Data: string;
  } | null> {
    const dataUrlMatch = imageUrl.match(
      /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s,
    );
    if (dataUrlMatch) {
      return {
        mimeType: dataUrlMatch[1],
        base64Data: dataUrlMatch[2],
      };
    }

    const fetchFn = await this.getFetch();
    const response = await fetchFn(imageUrl, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`Image fetch failed with status ${response.status}`);
    }

    const contentTypeHeader = response.headers?.get?.('content-type') || '';
    const mimeType = contentTypeHeader.split(';')[0].trim() || 'image/jpeg';
    if (!mimeType.startsWith('image/')) {
      throw new Error(`Unsupported content type: ${mimeType}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);
    const maxBytes = this.getMaxImageBytes();
    if (imageBuffer.byteLength > maxBytes) {
      throw new Error(
        `Image size ${imageBuffer.byteLength} exceeds max ${maxBytes}`,
      );
    }

    return {
      mimeType,
      base64Data: imageBuffer.toString('base64'),
    };
  }

  private async callGemini(params: {
    apiKey: string;
    imageBase64: string;
    mimeType: string;
    expectedWasteCategory?: string | null;
  }) {
    const fetchFn = await this.getFetch();
    const model = this.getModel();
    const apiBase = this.getApiBaseUrl();
    const apiVersion = this.getApiVersion();
    const endpoint = `${apiBase}/${apiVersion}/models/${model}:generateContent?key=${params.apiKey}`;

    const expectedCategoryLine = params.expectedWasteCategory
      ? `Expected pickup category: ${params.expectedWasteCategory}.`
      : 'Expected pickup category: not provided.';

    const prompt = [
      'You are validating a pickup photo for a recycling app.',
      expectedCategoryLine,
      'Return ONLY valid JSON with this exact shape:',
      '{"verdict": "MATCHING_WASTE|WASTE_BUT_DIFFERENT|NON_WASTE|UNCERTAIN", "isWaste": boolean, "detectedObject": string, "confidence": number, "reason": string}',
      'Rules:',
      '- MATCHING_WASTE: image clearly shows waste/recyclables and matches expected category.',
      '- WASTE_BUT_DIFFERENT: image shows waste but mostly of another category.',
      '- NON_WASTE: selfie, person, pet, scenery, unrelated products, random non-waste scene.',
      '- UNCERTAIN: blurry/occluded/not enough signal.',
      '- confidence must be between 0 and 1.',
      '- If uncertain, prefer NON_WASTE or UNCERTAIN instead of MATCHING_WASTE.',
      '- Do not include markdown.',
    ].join('\n');

    const response = await fetchFn(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: params.mimeType,
                  data: params.imageBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 256,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `Gemini response ${response.status}: ${errText.slice(0, 300)}`,
      );
    }

    const data = await response.json();
    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((part: any) => part?.text)
        .filter(Boolean)
        .join('') || '';

    if (!text.trim()) {
      throw new Error('Gemini returned an empty payload.');
    }

    return text;
  }

  private parseGeminiResponse(text: string, expectedCategory?: string | null) {
    const parsedJson = this.tryParseJson(text);
    if (!parsedJson) {
      return {
        verdict: 'UNCERTAIN' as ScreeningVerdict,
        detectedObject: 'unverified image',
        confidence: 0,
        reason: 'Unable to parse model output',
      };
    }

    const payload = parsedJson as GeminiScreeningResponse;
    const detectedObject =
      typeof payload.detectedObject === 'string' &&
      payload.detectedObject.trim().length > 0
        ? payload.detectedObject.trim()
        : 'unknown';
    const reason =
      typeof payload.reason === 'string' ? payload.reason.trim() : '';

    const explicitNonWaste = this.hasExplicitNonWasteSignal(
      detectedObject,
      reason,
    );
    let verdict = this.parseVerdict(payload.verdict);

    if (!verdict) {
      const isWaste = this.parseBoolean(payload.isWaste, !explicitNonWaste);
      if (isWaste) {
        verdict = 'MATCHING_WASTE';
      } else {
        verdict = explicitNonWaste ? 'NON_WASTE' : 'UNCERTAIN';
      }
    }

    if (
      verdict === 'MATCHING_WASTE' &&
      expectedCategory &&
      this.hasCategoryMismatchSignal(detectedObject, reason, expectedCategory)
    ) {
      verdict = 'WASTE_BUT_DIFFERENT';
    }

    const rawConfidence =
      typeof payload.confidence === 'number'
        ? payload.confidence
        : Number.parseFloat(String(payload.confidence ?? ''));
    const confidence = Number.isFinite(rawConfidence)
      ? Math.max(0, Math.min(1, rawConfidence))
      : 0.5;

    return {
      verdict,
      detectedObject,
      confidence,
      reason,
    };
  }

  private parseVerdict(value: unknown): ScreeningVerdict | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toUpperCase();
    if (normalized === 'MATCHING_WASTE') return 'MATCHING_WASTE';
    if (normalized === 'WASTE_BUT_DIFFERENT') return 'WASTE_BUT_DIFFERENT';
    if (normalized === 'NON_WASTE') return 'NON_WASTE';
    if (normalized === 'UNCERTAIN') return 'UNCERTAIN';
    if (normalized === 'NOT_WASTE' || normalized === 'NON-WASTE') {
      return 'NON_WASTE';
    }
    return null;
  }

  private hasExplicitNonWasteSignal(detectedObject: string, reason: string) {
    const text = `${detectedObject} ${reason}`.toLowerCase();
    const keywords = [
      'person',
      'human',
      'selfie',
      'portrait',
      'face',
      'pet',
      'dog',
      'cat',
      'animal',
      'landscape',
      'scenery',
      'sky',
      'beach',
      'mountain',
      'document',
      'screenshot',
      'screen',
      'monitor',
      'laptop',
      'phone',
      'not waste',
      'non-waste',
      'irrelevant',
      'unrelated',
    ];

    return keywords.some((token) => text.includes(token));
  }

  private hasCategoryMismatchSignal(
    detectedObject: string,
    reason: string,
    expectedCategory: string,
  ) {
    const haystack = `${detectedObject} ${reason}`.toLowerCase();
    const normalizedExpected = expectedCategory.toLowerCase();
    if (!normalizedExpected.trim()) return false;

    // If model explicitly mentions a different category and not the expected one,
    // treat this as category mismatch.
    const categoryHints = [
      'plastic',
      'paper',
      'glass',
      'metal',
      'organic',
      'e-waste',
      'electronic',
      'textile',
    ];

    const foundHint = categoryHints.find((hint) => haystack.includes(hint));
    if (!foundHint) return false;

    return !haystack.includes(normalizedExpected);
  }

  private parseBoolean(value: unknown, fallback: boolean) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
      if (['yes', 'y', 'waste', 'recyclable', 'recycle'].includes(normalized)) {
        return true;
      }
      if (
        [
          'no',
          'n',
          'not_waste',
          'non_waste',
          'non-waste',
          'irrelevant',
        ].includes(normalized)
      ) {
        return false;
      }
    }
    if (typeof value === 'number') {
      if (value === 1) return true;
      if (value === 0) return false;
    }
    return fallback;
  }

  private tryParseJson(text: string) {
    const directCandidate = text.trim();
    const fenced = directCandidate.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    const candidate = fenced?.trim() || directCandidate;
    const objectCandidate = this.sliceJsonObject(candidate);
    const options = [candidate, objectCandidate].filter(Boolean) as string[];

    for (const option of options) {
      try {
        return JSON.parse(option);
      } catch {
        continue;
      }
    }

    return null;
  }

  private sliceJsonObject(value: string) {
    const firstBrace = value.indexOf('{');
    const lastBrace = value.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      return null;
    }
    return value.slice(firstBrace, lastBrace + 1);
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
        } catch {
          throw new Error(
            'No fetch available. Run on Node 18+ or install undici/node-fetch',
          );
        }
      }
    }
    return fetchFn;
  }
}
