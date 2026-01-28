import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BookingsService } from './bookings.service';

@UseGuards(JwtAuthGuard)
@Controller('pickups')
export class PickupsController {
  constructor(private bookingsService: BookingsService) {}

  @Get('pending')
  pending(@Req() req: any) {
    return this.bookingsService.pendingPickups(req.user.sub);
  }
}
