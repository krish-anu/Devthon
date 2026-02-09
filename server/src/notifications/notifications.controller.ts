import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private notificationsService: NotificationsService,
    private pushService: PushService,
  ) {}

  @Get()
  list(@Req() req: any) {
    return this.notificationsService.list(req.user.sub);
  }

  @Post('mark-all-read')
  markAllRead(@Req() req: any) {
    return this.notificationsService.markAllRead(req.user.sub);
  }

  /** Returns the VAPID public key so the client can subscribe */
  @Get('push/public-key')
  getPublicKey() {
    return { publicKey: this.pushService.getPublicKey() };
  }

  /** Save a push subscription for the current user */
  @Post('push/subscribe')
  subscribe(
    @Req() req: any,
    @Body() body: { endpoint: string; keys: { p256dh: string; auth: string } },
  ) {
    return this.pushService.subscribe(req.user.sub, body);
  }

  /** Remove a push subscription */
  @Post('push/unsubscribe')
  unsubscribe(@Req() req: any, @Body() body: { endpoint: string }) {
    return this.pushService.unsubscribe(req.user.sub, body.endpoint);
  }

  /**
   * Test endpoint: trigger a demo push notification to the current user.
   * Useful for verifying subscription & service worker flow.
   */
  @Post('push/test')
  async testPush(
    @Req() req: any,
    @Body() body: { title?: string; body?: string },
  ) {
    const title = body?.title ?? 'Test notification';
    const message = body?.body ?? 'This is a test push from the server.';
    return this.pushService.notify(req.user.sub, {
      title,
      body: message,
      level: 'INFO' as any,
    });
  }
}
