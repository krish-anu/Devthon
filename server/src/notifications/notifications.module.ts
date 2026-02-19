import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';
import { UsersNotificationsController } from './users-notifications.controller';

@Module({
  controllers: [NotificationsController, UsersNotificationsController],
  providers: [NotificationsService, PushService],
  exports: [PushService],
})
export class NotificationsModule {}
