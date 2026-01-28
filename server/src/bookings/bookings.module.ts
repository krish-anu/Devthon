import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { PickupsController } from './pickups.controller';

@Module({
  controllers: [BookingsController, PickupsController],
  providers: [BookingsService],
})
export class BookingsModule {}
