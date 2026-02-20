import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { cursorPaginate } from '../common/pagination';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async list(
    userId: string,
    opts?: { after?: string; before?: string; limit?: number },
  ) {
    const where = { OR: [{ userId }, { userId: null }] };

    if (opts?.after || opts?.before || opts?.limit) {
      const page = await cursorPaginate(
        (args) => this.prisma.notification.findMany({ ...(args as any) }),
        () => this.prisma.notification.count({ where }),
        {
          where,
          orderBy: { createdAt: 'desc' },
          after: opts?.after,
          before: opts?.before,
          limit: opts?.limit ?? 10,
        },
      );

      return {
        items: page.items,
        nextCursor: page.nextCursor,
        prevCursor: page.prevCursor,
        hasMore: page.hasMore,
      } as any;
    }

    return this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId },
      data: { isRead: true },
    });

    // Refresh cached notification queries for this user
    await ((this.cacheManager as any).clear?.() ?? (this.cacheManager as any).reset?.());

    return { success: true };
  }

  /** Mark a single notification as read (user-owned or broadcast). */
  async markRead(userId: string, notificationId: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        OR: [{ userId }, { userId: null }],
      },
      data: { isRead: true },
    });

    // Invalidate cached notification list so UI updates immediately
    await ((this.cacheManager as any).clear?.() ?? (this.cacheManager as any).reset?.());

    return { success: count > 0 };
  }
}
