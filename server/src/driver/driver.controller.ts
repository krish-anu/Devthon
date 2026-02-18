import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { DriverService } from './driver.service';
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

  @Patch('status')
  updateStatus(@Body() dto: UpdateDriverStatusDto, @Req() req: any) {
    return this.driverService.updateStatus(req.user.sub, dto.status);
  }
}
