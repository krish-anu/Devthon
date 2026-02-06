import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { AdminCreateDriverDto } from './dto/admin-create-driver.dto';
import { AdminUpdateDriverDto } from './dto/admin-update-driver.dto';
import { AdminUpdatePricingDto } from './dto/admin-update-pricing.dto';
import { AdminBookingsQueryDto } from './dto/admin-bookings-query.dto';
import { AdminSendSmsDto } from './dto/admin-send-sms.dto';
import { SmsService } from '../sms/sms.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private smsService: SmsService,
  ) {}

  @Get('metrics')
  getMetrics() {
    return this.adminService.getMetrics();
  }

  @Get('users')
  listUsers(@Query('search') search?: string, @Query('type') type?: string) {
    return this.adminService.listUsers(search, type);
  }

  @Post('users')
  createUser(@Body() dto: AdminCreateUserDto) {
    return this.adminService.createUser(dto);
  }

  @Patch('users/:id')
  updateUser(@Param('id') id: string, @Body() dto: AdminUpdateUserDto) {
    return this.adminService.updateUser(id, dto);
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  @Get('drivers')
  listDrivers() {
    return this.adminService.listDrivers();
  }

  @Post('drivers')
  createDriver(@Body() dto: AdminCreateDriverDto) {
    return this.adminService.createDriver(dto);
  }

  @Patch('drivers/:id')
  updateDriver(@Param('id') id: string, @Body() dto: AdminUpdateDriverDto) {
    return this.adminService.updateDriver(id, dto);
  }

  @Delete('drivers/:id')
  deleteDriver(@Param('id') id: string) {
    return this.adminService.deleteDriver(id);
  }

  @Get('bookings')
  listBookings(@Query() query: AdminBookingsQueryDto) {
    return this.adminService.listBookings(query);
  }

  @Get('pricing')
  listPricing() {
    return this.adminService.listPricing();
  }

  @Patch('pricing')
  updatePricing(@Body() dto: AdminUpdatePricingDto) {
    return this.adminService.updatePricing(dto);
  }

  @Post('sms/send')
  async sendSms(@Body() dto: AdminSendSmsDto) {
    // Join phone numbers with comma for Text.lk API
    const recipient = dto.phoneNumbers.join(',');
    return this.smsService.sendSms(recipient, dto.message);
  }

  @Get('sms/balance')
  async getSmsBalance() {
    return this.smsService.getBalance();
  }
}
