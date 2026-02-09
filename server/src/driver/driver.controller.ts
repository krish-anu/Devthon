import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { DriverService } from './driver.service';

@UseGuards(JwtAuthGuard)
@Controller('driver')
export class DriverController {
  constructor(private driverService: DriverService) {}

  @Get('bookings')
  getBookings(@Req() req: any) {
    // req.user.sub is the driver's userId
    return this.driverService.getBookings(req.user.sub);
  }
}
