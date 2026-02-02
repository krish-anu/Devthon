import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  async getSuggestions(): Promise<string[] | null> {
    this.logger.log(
      'SearchService.getSuggestions called but search is disabled',
    );
    return null;
  }

  private fallbackSuggestions(query: string) {
    return { suggestions: [] };
  }
}
