import { Controller, Post, Body } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post('suggestions')
  async suggest(@Body('query') query: string) {
    return this.searchService.getSuggestions(query);
  }
}
