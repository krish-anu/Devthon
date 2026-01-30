import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class CacheExampleService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async getOrSet<T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
    const cached = await this.cacheManager.get<T>(key);
    if (cached) return cached;
    const data = await fetcher();
    // Pass numeric TTL (cache-manager set expects a number for TTL)
    await this.cacheManager.set(key, data, ttl);
    return data;
  }
}
 