import { Module } from '@nestjs/common';
import { LoggingModule } from '../common/logger/logger.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { PickupsController } from './pickups.controller';
import { RewardsModule } from '../rewards/rewards.module';
import { AdminBookingsController } from './admin-bookings.controller';

@Module({
  imports: [LoggingModule, RewardsModule],
  controllers: [BookingsController, PickupsController, AdminBookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
