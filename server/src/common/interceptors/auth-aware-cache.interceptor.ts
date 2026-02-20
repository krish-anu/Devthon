import { ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER, CacheInterceptor } from '@nestjs/cache-manager';
import { Reflector } from '@nestjs/core';

@Injectable()
export class AuthAwareCacheInterceptor extends CacheInterceptor {
  constructor(
    @Inject(CACHE_MANAGER) cacheManager: any,
    reflector: Reflector,
  ) {
    super(cacheManager, reflector);
  }
  protected isRequestCacheable(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<any>();
    if (!req || req.method !== 'GET') {
      return false;
    }

    // Never cache authenticated traffic. URL-only keys can leak user-specific data
    // (e.g. /me) between users when a global cache interceptor is enabled.
    if (req.user?.sub) {
      return false;
    }

    const authHeader = req.headers?.authorization;
    if (typeof authHeader === 'string' && authHeader.trim().length > 0) {
      return false;
    }

    return true;
  }
}
