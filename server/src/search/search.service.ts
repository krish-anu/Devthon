import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { GeminiService } from '../gemini/gemini.service';

@Injectable()
export class SearchService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly gemini: GeminiService,
  ) {}

  async getSuggestions(query: string) {
    const key = `search:${(query || '').toLowerCase().trim()}`;
    try {
      const cached = await this.cacheManager.get<{ suggestions: string[] }>(
        key as string,
      );
      if (cached) return cached;
    } catch (e) {
      // cache read failure should not block search
      console.warn('SearchService: cache read failed', e);
    } 

    // Attempt to use GeminiService to generate suggestions
    try {
      const suggestions = await this.gemini.generateSuggestions(query, 5);
      if (suggestions && Array.isArray(suggestions) && suggestions.length) {
        const result = { suggestions: suggestions.slice(0, 5) };
        try {
          await this.cacheManager.set(key as string, result, 60 * 60 * 24);
        } catch (e) {
          /* ignore cache set errors */
        }
        return result;
      }
    } catch (err) {
      console.warn('SearchService: Gemini generation failed', err);
    }

    // Fallback if Gemini not available or returned unexpected data
    const fb = this.fallbackSuggestions(query);
    try {
      await this.cacheManager.set(key as string, fb, 60 * 60 * 24);
    } catch (e) {
      /* ignore cache set errors */
    }
    return fb;
  }

  private fallbackSuggestions(query: string) {
    const items = [
      'plastic bottles',
      'cardboard',
      'metal cans',
      'glass bottles',
      'paper',
      'plastic containers',
      'aluminum cans',
      'electronic waste',
      'textiles',
      'batteries',
    ];

    const q = (query || '').toLowerCase().trim();
    let suggestions = items.filter((it) => it.includes(q));
    if (!suggestions.length) {
      suggestions = items.filter((it) => it.startsWith(q));
    }
    if (!suggestions.length) suggestions = items;
    return { suggestions: suggestions.slice(0, 5) };
  }
}
