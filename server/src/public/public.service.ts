import { ConflictException, Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeWasteName } from '../lib/wasteTypeUtils';

@Injectable()
export class PublicService {
  private readonly logger = new Logger(PublicService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async getPricing() {
    return this.prisma.pricing.findMany({
      where: { isActive: true },
      include: { wasteCategory: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Publicly list active waste categories for client UIs.
   */
  async getWasteCategories() {
    const categories = await this.prisma.wasteCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, description: true },
    });

    return categories.map((category) => ({
      ...category,
      slug: normalizeWasteName(category.name),
    }));
  }

  async launchNotify(email: string) {
    try {
      return await this.prisma.launchNotify.create({ data: { email } });
    } catch (error) {
      throw new ConflictException('Email already registered');
    }
  }

  async classifyImage(imageBase64: string) {
    const key = this.config.get<string>('GEMINI_API_KEY');
    if (!key) {
      throw new BadRequestException('GEMINI_API_KEY is not configured');
    }

    // Get all active waste categories from the database
    const categories = await this.prisma.wasteCategory.findMany({
      where: { isActive: true },
      select: { id: true, name: true, description: true },
    });

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
