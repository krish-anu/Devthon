import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  ServiceUnavailableException,
  Param,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';
import { Public } from '../common/decorators/public.decorator';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private notificationsService: NotificationsService,
    private pushService: PushService,
  ) {}

  @Get()
  list(
    @Req() req: any,
    @Query('after') after?: string,
    @Query('before') before?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.list(req.user.sub, {
      after: after ?? undefined,
      before: before ?? undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('mark-all-read')
  markAllRead(@Req() req: any) {
    return this.notificationsService.markAllRead(req.user.sub);
  }

  @Post(':id/mark-read')
  markRead(@Req() req: any, @Param('id') id: string) {
    return this.notificationsService.markRead(req.user.sub, id);
  }

  /** Returns the VAPID public key so the client can subscribe */
  @Get('push/public-key')
  @Public()
  getPublicKey() {
    const publicKey = this.pushService.getPublicKey();
    if (!publicKey) {
      // Return a structured error payload so clients can detect this specific case.
      throw new (require('@nestjs/common').HttpException)(
        {
          error: 'VAPID_NOT_CONFIGURED',
          message: 'VAPID public key not configured on server',
        },
        503,
      );
    }
    return { publicKey };
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
