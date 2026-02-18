import {
  Controller,
  Get,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BookingsService } from './bookings.service';

type AuthRequest = {
  user?: {
    sub?: string;
    id?: string;
  };
};

@UseGuards(JwtAuthGuard)
@Controller('pickups')
export class PickupsController {
  constructor(private bookingsService: BookingsService) {}

  private getUserId(req: AuthRequest) {
    const userId = req.user?.sub ?? req.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return userId;
  }

  @Get('pending')
  pending(@Req() req: AuthRequest) {
    return this.bookingsService.pendingPickups(this.getUserId(req));
  }
}
