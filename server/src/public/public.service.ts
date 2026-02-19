import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeWasteName } from '../lib/wasteTypeUtils';

@Injectable()
export class PublicService {
  private readonly logger = new Logger(PublicService.name);
  private readonly dbTimeoutMs: number;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    const configured = Number.parseInt(
      this.config.get<string>('PUBLIC_DB_QUERY_TIMEOUT_MS') ??
        this.config.get<string>('DB_QUERY_TIMEOUT_MS') ??
        '',
      10,
    );
    this.dbTimeoutMs = Number.isFinite(configured) && configured > 0 ? configured : 10000;
  }

  private async withDbTimeout<T>(label: string, task: () => Promise<T>): Promise<T> {
    const startedAt = Date.now();
    let timeoutHandle: NodeJS.Timeout | null = null;

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(
            new ServiceUnavailableException(
              `Database request timed out while loading ${label}`,
            ),
          );
        }, this.dbTimeoutMs);
      });

      const result = await Promise.race([task(), timeoutPromise]);
      this.logger.log(`Completed ${label} in ${Date.now() - startedAt}ms`);
      return result as T;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed ${label} after ${Date.now() - startedAt}ms: ${message}`,
      );
      throw error;
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  async getPricing() {
    return this.withDbTimeout('public pricing', () =>
      this.prisma.pricing.findMany({
        where: { isActive: true },
        include: { wasteCategory: true },
        orderBy: { updatedAt: 'desc' },
      }),
    );
  }

  /**
   * Publicly list active waste categories for client UIs.
   */
  async getWasteCategories() {
    return this.withDbTimeout('public waste categories', () =>
      this.prisma.wasteCategory.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, description: true },
      }),
    );
  }

  async launchNotify(email: string) {
    try {
      return await this.withDbTimeout('launch notify create', () =>
        this.prisma.launchNotify.create({ data: { email } }),
      );
    } catch (error: any) {
      if (error?.code !== 'P2002') {
        throw error;
      }
      throw new ConflictException('Email already registered');
    }
  }

  async classifyImage(imageBase64: string) {
    const key = this.config.get<string>('GEMINI_API_KEY');
    if (!key) {
      throw new BadRequestException('GEMINI_API_KEY is not configured');
    }

    // Get all active waste categories from the database
    const categories = await this.withDbTimeout('classify image categories', () =>
      this.prisma.wasteCategory.findMany({
        where: { isActive: true },
        select: { id: true, name: true, description: true },
      }),
    );

    const categoryNames = categories.map(c => c.name).join(', ');

    try {
      // Call Gemini Vision API
      const fetchFn = (global as any).fetch || (await import('node-fetch')).default;
      const model = 'gemini-1.5-flash';
      const apiUrl = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${key}`;

      const prompt = `You are a waste classification assistant. Analyze this image and determine which waste category it belongs to.

Available categories: ${categoryNames}

Instructions:
- Look at the image carefully and identify the main waste item(s)
- Return ONLY the category name that best matches the waste in the image
- Choose from the available categories listed above
- If you're not sure, choose the closest match
- Return only the category name, nothing else

Respond with just the category name.`;

      const requestBody = {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: imageBase64,
                },
              },
            ],
          },
        ],
      };

      const response = await fetchFn(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Gemini Vision API error: ${response.status} ${errorText}`);
        throw new BadRequestException('Image classification failed');
      }

      const data = await response.json();
      const detectedText =
        data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

      if (!detectedText) {
        throw new BadRequestException('No category detected from image');
      }

      // Find the matching category
      const matchedCategory = categories.find(
        (c) => c.name.toLowerCase() === detectedText.toLowerCase(),
      );

      if (!matchedCategory) {
        // Try partial match
        const partialMatch = categories.find((c) =>
          detectedText.toLowerCase().includes(c.name.toLowerCase()) ||
          c.name.toLowerCase().includes(detectedText.toLowerCase())
        );
        
        if (partialMatch) {
          return {
            categoryId: partialMatch.id,
            categoryName: partialMatch.name,
            confidence: 'medium',
          };
        }

        // Return the first category as fallback with low confidence
        return {
          categoryId: categories[0]?.id || null,
          categoryName: categories[0]?.name || 'Unknown',
          confidence: 'low',
          message: `Could not match detected category "${detectedText}" with available categories. Please select manually.`,
        };
      }

      return {
        categoryId: matchedCategory.id,
        categoryName: matchedCategory.name,
        confidence: 'high',
      };
    } catch (error: any) {
      this.logger.error('Image classification error', error?.message ?? error);
      throw new BadRequestException(
        error?.message || 'Image classification failed',
      );
    }
  }
}
