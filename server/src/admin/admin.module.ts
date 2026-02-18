import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SmsModule } from '../sms/sms.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RewardsModule } from '../rewards/rewards.module';

@Module({
  imports: [SmsModule, NotificationsModule, RewardsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
