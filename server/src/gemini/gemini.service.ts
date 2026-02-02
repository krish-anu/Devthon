// Gemini service removed: AI search features disabled.
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);

  async validateKey(): Promise<boolean> {
    this.logger.log('GeminiService.validateKey called but Gemini is disabled');
    return false;
  }

  async generateSuggestions(): Promise<string[] | null> {
    this.logger.log(
      'GeminiService.generateSuggestions called but Gemini is disabled',
    );
    return null;
  }
}
