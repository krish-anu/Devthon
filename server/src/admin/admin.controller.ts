import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
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
import { AdminUpdateBookingDto } from './dto/admin-update-booking.dto';
import { AdminBookingsQueryDto } from './dto/admin-bookings-query.dto';
import { AdminSendSmsDto } from './dto/admin-send-sms.dto';
import { AdminCreateWasteCategoryDto } from './dto/admin-create-waste-category.dto';
import { AdminUpdateWasteCategoryDto } from './dto/admin-update-waste-category.dto';
import { AdminAssignDriverDto } from './dto/admin-assign-driver.dto';
import { UpdateBookingStatusDto } from '../bookings/dto/update-booking-status.dto';
import { SmsService } from '../sms/sms.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
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
  listUsers(
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('after') after?: string,
    @Query('before') before?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listUsers(search, type, {
      after: after ?? undefined,
      before: before ?? undefined,
      limit: limit ? Number(limit) : undefined,
    });
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
  deleteUser(@Param('id') id: string, @Req() req: any) {
    if (id === req.user.sub) {
      throw new ForbiddenException('Cannot delete your own admin account');
    }
    return this.adminService.deleteUser(id);
  }

  @Get('drivers')
  listDrivers(
    @Query('after') after?: string,
    @Query('before') before?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listDrivers({ after: after ?? undefined, before: before ?? undefined, limit: limit ? Number(limit) : undefined });
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

  @Get('bookings/status-options')
  listBookingStatusOptions() {
    return this.adminService.listSupportedBookingStatuses();
  }

  @Get('bookings')
  listBookings(@Query() query: AdminBookingsQueryDto) {
    return this.adminService.listBookings(query);
  }

  @Patch('bookings/:id')
  updateBooking(
    @Param('id') id: string,
    @Body() dto: AdminUpdateBookingDto,
    @Req() req: any,
  ) {
    return this.adminService.updateBooking(id, dto, req.user);
  }

  @Patch('bookings/:id/assign')
  assignDriver(
    @Param('id') id: string,
    @Body() dto: AdminAssignDriverDto,
    @Req() req: any,
  ) {
    return this.adminService.assignDriver(id, dto.driverId, req.user);
  }

  @Patch('bookings/:id/status')
  updateBookingStatus(
    @Param('id') id: string,
    @Body() dto: UpdateBookingStatusDto,
    @Req() req: any,
  ) {
    return this.adminService.updateBookingStatus(id, dto, req.user);
  }

  /** Admin-only debug endpoint: trigger a test 'completed' notification */
  @Post('bookings/:id/notify-complete')
  triggerBooking(@Param('id') id: string) {
    return this.adminService.triggerBookingCompletedNotification(id);
  }

  @Get('pricing')
  listPricing() {
    return this.adminService.listPricing();
  }

  @Patch('pricing')
  updatePricing(@Body() dto: AdminUpdatePricingDto) {
    return this.adminService.updatePricing(dto);
  }

  // Waste Category management
  @Get('waste-categories')
  listWasteCategories() {
    return this.adminService.listWasteCategories();
  }

  @Post('waste-categories')
  createWasteCategory(@Body() dto: AdminCreateWasteCategoryDto) {
    return this.adminService.createWasteCategory(dto);
  }

  @Patch('waste-categories/:id')
  updateWasteCategory(@Param('id') id: string, @Body() dto: AdminUpdateWasteCategoryDto) {
    return this.adminService.updateWasteCategory(id, dto);
  }

  @Delete('waste-categories/:id')
  deleteWasteCategory(@Param('id') id: string) {
    return this.adminService.deleteWasteCategory(id);
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

  // ─────────────────────────────────────────────
  // Super Admin Only endpoints
  // ─────────────────────────────────────────────

  @Roles(Role.SUPER_ADMIN)
  @Get('pending-approvals')
  listPendingApprovals() {
    return this.adminService.listPendingApprovals();
  }

  @Roles(Role.SUPER_ADMIN)
  @Patch('approve/:id')
  approveUser(@Param('id') id: string) {
    return this.adminService.approveUser(id);
  }

  @Roles(Role.SUPER_ADMIN)
  @Delete('reject/:id')
  rejectUser(@Param('id') id: string) {
    return this.adminService.rejectUser(id);
  }

  @Roles(Role.SUPER_ADMIN)
  @Get('all-users')
  listAllUsersWithRoles(
    @Query('after') after?: string,
    @Query('before') before?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listAllUsersWithRoles({ after: after ?? undefined, before: before ?? undefined, limit: limit ? Number(limit) : undefined });
  }

  @Roles(Role.SUPER_ADMIN)
  @Patch('change-role/:id')
  changeUserRole(@Param('id') id: string, @Body('role') role: string) {
    return this.adminService.changeUserRole(id, role);
  }

}
