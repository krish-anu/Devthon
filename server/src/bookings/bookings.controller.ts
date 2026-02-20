import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BookingsService } from './bookings.service';
import { BookingsQueryDto } from './dto/bookings-query.dto';
import { CreateBookingDto } from './dto/create-booking.dto';

type AuthRequest = {
  user?: {
    sub?: string;
    id?: string;
    role?: string;
  };
};

@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  private getUserId(req: AuthRequest) {
    const userId = req.user?.sub ?? req.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return userId;
  }

  @CacheTTL(0)
  @Get()
  list(@Req() req: AuthRequest, @Query() query: BookingsQueryDto) {
    return this.bookingsService.list(this.getUserId(req), query);
  }

  @CacheTTL(0)
  @Get(':id')
  getById(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.bookingsService.getById(this.getUserId(req), id);
  }

  @Post()
  create(@Req() req: AuthRequest, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(this.getUserId(req), dto);
  }

  @Post(':id/cancel')
  cancel(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.bookingsService.cancel(this.getUserId(req), id);
  }

  @Post(':id/location')
  updateLocation(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: { lng: number; lat: number },
  ) {
    return this.bookingsService.updateLocation(
      this.getUserId(req),
      id,
      body.lng,
      body.lat,
    );
  }

  @Delete(':id')
  delete(@Req() req: AuthRequest, @Param('id') id: string) {
    // Pass role through so admins can delete any booking
    const role = req.user?.role ?? 'CUSTOMER';
    return this.bookingsService.delete(this.getUserId(req), id, role);
  }
}
