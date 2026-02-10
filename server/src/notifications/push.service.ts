import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationLevel } from '@prisma/client';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

export interface PushPayload {
  title: string;
  body: string;
  level?: NotificationLevel;
  bookingId?: string;
  url?: string;
  icon?: string;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly enabled: boolean;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.config.get<string>('VAPID_SUBJECT') || 'mailto:admin@trash2cash.lk';

    if (publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.enabled = true;
      this.logger.log('Web Push (VAPID) configured');
    } else {
      this.enabled = false;
      this.logger.warn(
        'VAPID keys not set – push notifications disabled. Run: npx web-push generate-vapid-keys',
      );
    }
  }

  /** Subscribe a user's browser to push notifications */
  async subscribe(
    userId: string,
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  ) {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      update: {
        userId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });
  }

  /** Unsubscribe a specific endpoint */
  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.pushSubscription
      .deleteMany({ where: { userId, endpoint } })
      .catch(() => {});
    return { success: true };
  }

  /**
   * Send a push notification to a specific user (all their subscribed devices).
   * Also persists the notification in the DB.
   */
  async notify(userId: string, payload: PushPayload) {
    // 1. Persist in-app notification
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        title: payload.title,
        message: payload.body,
        level: payload.level ?? NotificationLevel.INFO,
        bookingId: payload.bookingId ?? null,
      },
    });

    // 2. Send web-push to all subscribed devices
    if (this.enabled) {
      const subscriptions = await this.prisma.pushSubscription.findMany({
        where: { userId },
      });

      const pushPayload = JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: payload.icon ?? '/favicon.svg',
        data: {
          url: payload.url ?? (payload.bookingId ? `/users/bookings/${payload.bookingId}` : '/users/notifications'),
          bookingId: payload.bookingId,
          level: payload.level ?? 'INFO',
          notificationId: notification.id,
        },
      });

      const results = await Promise.allSettled(
        subscriptions.map((sub) =>
          webpush
            .sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              },
              pushPayload,
            )
            .catch(async (err) => {
              // Remove invalid/expired subscriptions (410 Gone or 404)
              if (err.statusCode === 410 || err.statusCode === 404) {
                await this.prisma.pushSubscription
                  .delete({ where: { id: sub.id } })
                  .catch(() => {});
              }
              throw err;
            }),
        ),
      );

      const sent = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) {
        this.logger.warn(`Push: ${sent} sent, ${failed} failed for user ${userId}`);
      }
    }

    return notification;
  }

  /**
   * Send a broadcast notification (no specific user — admin/system alerts).
   */
  async broadcast(payload: PushPayload) {
    // Persist as a system notification (userId = null)
    await this.prisma.notification.create({
      data: {
        userId: null,
        title: payload.title,
        message: payload.body,
        level: payload.level ?? NotificationLevel.INFO,
        bookingId: payload.bookingId ?? null,
      },
    });

    if (!this.enabled) return;

    const allSubs = await this.prisma.pushSubscription.findMany();
    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon ?? '/favicon.svg',
      data: {
        url: payload.url ?? '/users/notifications',
        level: payload.level ?? 'INFO',
      },
    });

    await Promise.allSettled(
      allSubs.map((sub) =>
        webpush
          .sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            pushPayload,
          )
          .catch(async (err) => {
            if (err.statusCode === 410 || err.statusCode === 404) {
              await this.prisma.pushSubscription
                .delete({ where: { id: sub.id } })
                .catch(() => {});
            }
          }),
      ),
    );
  }

  /** Return the public VAPID key (needed by the client to subscribe) */
  getPublicKey(): string | null {
    return this.config.get<string>('VAPID_PUBLIC_KEY') ?? null;
  }
}
