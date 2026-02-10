import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BookingsService } from './bookings.service';
import { BookingsQueryDto } from './dto/bookings-query.dto';
import { CreateBookingDto } from './dto/create-booking.dto';

@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  @Get()
  list(@Req() req: any, @Query() query: BookingsQueryDto) {
    return this.bookingsService.list(req.user.sub, query);
  }

  @Get(':id')
  getById(@Req() req: any, @Param('id') id: string) {
    return this.bookingsService.getById(req.user.sub, id);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(req.user.sub, dto);
  }

  @Post(':id/cancel')
  cancel(@Req() req: any, @Param('id') id: string) {
    return this.bookingsService.cancel(req.user.sub, id);
  }

  @Post(':id/location')
  updateLocation(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { lng: number; lat: number },
  ) {
    return this.bookingsService.updateLocation(req.user.sub, id, body.lng, body.lat);
  }

  @Delete(':id')
  delete(@Req() req: any, @Param('id') id: string) {
    // Pass role through so admins can delete any booking
    const role = req.user?.role ?? 'CUSTOMER';
    return this.bookingsService.delete(req.user.sub, id, role);
  }
}
