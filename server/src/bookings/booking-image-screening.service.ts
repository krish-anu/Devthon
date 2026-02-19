import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type ScreeningResult = {
  imageUrl: string;
  isWaste: boolean;
  detectedObject: string;
  confidence: number;
  reason: string;
};

type GeminiScreeningResponse = {
  isWaste?: unknown;
  detectedObject?: unknown;
  confidence?: unknown;
  reason?: unknown;
};

const DEFAULT_MODEL = 'gemini-1.5-flash';
const DEFAULT_API_BASE_URL = 'https://generativelanguage.googleapis.com';
const DEFAULT_API_VERSION = 'v1';
const DEFAULT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;

@Injectable()
export class BookingImageScreeningService {
  private readonly logger = new Logger(BookingImageScreeningService.name);
  private missingApiKeyWarned = false;

  constructor(private readonly config: ConfigService) {}

  async screenImages(imageUrls: string[]): Promise<ScreeningResult[]> {
    const uniqueUrls = [...new Set(imageUrls.filter(Boolean))];
    if (uniqueUrls.length === 0) return [];

    const results = await Promise.all(
      uniqueUrls.map(async (imageUrl) => this.screenImage(imageUrl)),
    );

    return results.filter((item): item is ScreeningResult => Boolean(item));
  }

  private async screenImage(imageUrl: string): Promise<ScreeningResult | null> {
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
      });

      const parsed = this.parseGeminiResponse(responseText);
      return {
        imageUrl,
        isWaste: parsed.isWaste,
        detectedObject: parsed.detectedObject,
        confidence: parsed.confidence,
        reason: parsed.reason,
      };
    } catch (error: any) {
      const message =
        error instanceof Error ? error.message : String(error ?? 'unknown');
      this.logger.warn(`Failed to screen image "${imageUrl}": ${message}`);
      return null;
    }
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
  }) {
    const fetchFn = await this.getFetch();
    const model = this.getModel();
    const apiBase = this.getApiBaseUrl();
    const apiVersion = this.getApiVersion();
    const endpoint = `${apiBase}/${apiVersion}/models/${model}:generateContent?key=${params.apiKey}`;

    const prompt = [
      'You are validating a pickup photo for a recycling app.',
      'Decide if the main subject is waste/recyclable material.',
      'Return ONLY valid JSON with this exact shape:',
      '{"isWaste": boolean, "detectedObject": string, "confidence": number, "reason": string}',
      'Use confidence between 0 and 1.',
      'Set isWaste=false for selfies, people portraits, pets, scenery, unrelated products, or non-waste scenes.',
      'If uncertain, set isWaste=false.',
      'Do not include markdown.',
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
        .join('') ||
      '';

    if (!text.trim()) {
      throw new Error('Gemini returned an empty payload.');
    }

    return text;
  }

  private parseGeminiResponse(text: string) {
    const parsedJson = this.tryParseJson(text);
    if (!parsedJson) {
      return {
        isWaste: true,
        detectedObject: 'unknown',
        confidence: 0.2,
        reason: 'Unable to parse model output',
      };
    }

    const payload = parsedJson as GeminiScreeningResponse;
    const parsedIsWaste =
      typeof payload.isWaste === 'boolean' ? payload.isWaste : true;
    const parsedObject =
      typeof payload.detectedObject === 'string' &&
      payload.detectedObject.trim().length > 0
        ? payload.detectedObject.trim()
        : 'unknown';
    const parsedReason =
      typeof payload.reason === 'string' ? payload.reason.trim() : '';
    const rawConfidence =
      typeof payload.confidence === 'number'
        ? payload.confidence
        : Number.parseFloat(String(payload.confidence ?? ''));
    const confidence = Number.isFinite(rawConfidence)
      ? Math.max(0, Math.min(1, rawConfidence))
      : 0.5;

    return {
      isWaste: parsedIsWaste,
      detectedObject: parsedObject,
      confidence,
      reason: parsedReason,
    };
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
