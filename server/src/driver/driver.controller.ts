import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { DriverService } from './driver.service';
import { CollectDriverBookingDto } from './dto/collect-driver-booking.dto';
import { CancelDriverBookingDto } from './dto/cancel-driver-booking.dto';
import { UpdateDriverBookingDto } from './dto/update-driver-booking.dto';
import { UpdateDriverStatusDto } from './dto/update-driver-status.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DRIVER)
@Controller('driver')
export class DriverController {
  constructor(private driverService: DriverService) {}

  @Get('bookings')
  getBookings(@Req() req: any) {
    // req.user.sub is the driver's userId
    return this.driverService.getBookings(req.user.sub);
  }

  @Get('bookings/:id')
  getBookingById(@Param('id') id: string, @Req() req: any) {
    return this.driverService.getBookingById(req.user.sub, id);
  }

  @Patch('bookings/:id/update')
  updateBooking(
    @Param('id') id: string,
    @Body() dto: UpdateDriverBookingDto,
    @Req() req: any,
  ) {
    return this.driverService.updateBooking(req.user.sub, id, dto);
  }

  @Patch('bookings/:id/start')
  startPickup(@Param('id') id: string, @Req() req: any) {
    return this.driverService.startPickup(req.user.sub, id);
  }

  @Patch('bookings/:id/collect')
  collectBooking(
    @Param('id') id: string,
    @Body() dto: CollectDriverBookingDto,
    @Req() req: any,
  ) {
    return this.driverService.collectBooking(req.user.sub, id, dto);
  }

  @Patch('bookings/:id/cancel')
  cancelBooking(
    @Param('id') id: string,
    @Body() dto: CancelDriverBookingDto,
    @Req() req: any,
  ) {
    return this.driverService.cancelBooking(req.user.sub, id, dto);
  }

  @Patch('status')
  updateStatus(@Body() dto: UpdateDriverStatusDto, @Req() req: any) {
    return this.driverService.updateStatus(req.user.sub, dto.status);
  }
}
