import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, DriverStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { flattenUser, USER_PROFILE_INCLUDE } from '../common/utils/user.utils';
import { calculateMidpointAmountLkr } from '../bookings/booking-amount';
import { getTransitionError } from '../bookings/booking-status';
import { RewardsService } from '../rewards/rewards.service';
import { UpdateDriverBookingDto } from './dto/update-driver-booking.dto';

const PICKUP_ACTIVE_BOOKING_STATUSES = new Set<BookingStatus>([
  BookingStatus.IN_PROGRESS,
  BookingStatus.COLLECTED,
]);
const MANUAL_DRIVER_STATUSES = new Set<DriverStatus>([
  DriverStatus.ONLINE,
  DriverStatus.OFFLINE,
]);

@Injectable()
export class DriverService {
  constructor(
    private prisma: PrismaService,
    private rewardsService: RewardsService,
  ) {}

  async getBookings(driverId: string) {
    const bookings = await this.prisma.booking.findMany({
      where: { driverId },
      include: {
        user: {
          include: USER_PROFILE_INCLUDE,
        },
        wasteCategory: true,
      },
      orderBy: { scheduledDate: 'asc' },
    });

    return bookings.map((b) => ({
      ...b,
      user: flattenUser(b.user),
    }));
  }

  async getBookingById(driverId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: {
          include: USER_PROFILE_INCLUDE,
        },
        wasteCategory: true,
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.driverId !== driverId) throw new ForbiddenException();

    return {
      ...booking,
      user: flattenUser(booking.user),
    };
  }

  async updateBooking(driverId: string, bookingId: string, dto: UpdateDriverBookingDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { wasteCategory: true },
    });

    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.driverId !== driverId) {
      throw new ForbiddenException('Booking is not assigned to this driver');
    }

    const nextStatus = dto.status ?? booking.status;
    const statusChanged = nextStatus !== booking.status;

    if (statusChanged) {
      const transitionError = getTransitionError(booking.status, nextStatus);
      if (transitionError) throw new BadRequestException(transitionError);
    }

    if (nextStatus === BookingStatus.COMPLETED) {
      const weight = dto.actualWeightKg ?? booking.actualWeightKg;
      if (weight === null || weight === undefined) {
        throw new BadRequestException('Pickup weight is required to complete the booking');
      }
    }

    const data: any = {};
    if (dto.status) data.status = dto.status;
    if (dto.actualWeightKg !== undefined) data.actualWeightKg = dto.actualWeightKg;
    if (dto.finalAmountLkr !== undefined) data.finalAmountLkr = dto.finalAmountLkr;
    if (dto.wasteCategoryId) data.wasteCategoryId = dto.wasteCategoryId;

    const shouldConfirm = nextStatus === BookingStatus.COMPLETED;
    if (shouldConfirm && !booking.confirmedAt) data.confirmedAt = new Date();

    const weightForAmount =
      dto.actualWeightKg !== undefined
        ? dto.actualWeightKg
        : booking.actualWeightKg ?? null;
    const categoryForPricing = dto.wasteCategoryId ?? booking.wasteCategoryId;
    if (data.finalAmountLkr === undefined && weightForAmount !== null) {
      const computed = await this.calculateFinalAmountLkr(categoryForPricing, weightForAmount);
      if (computed !== null) data.finalAmountLkr = computed;
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data,
      include: {
        user: {
          include: USER_PROFILE_INCLUDE,
        },
        wasteCategory: true,
      },
    });

    if (statusChanged) {
      await this.recordStatusHistory(booking.id, booking.status, nextStatus, driverId);
    }

    if (statusChanged && PICKUP_ACTIVE_BOOKING_STATUSES.has(nextStatus)) {
      await this.prisma.driver.update({
        where: { id: driverId },
        data: { status: DriverStatus.ON_PICKUP },
      });
    }

    if (statusChanged && nextStatus === BookingStatus.COMPLETED) {
      await this.prisma.driver.update({
        where: { id: driverId },
        data: {
          status: DriverStatus.ONLINE,
          pickupCount: { increment: 1 },
        },
      });
      await this.rewardsService.awardPointsForBooking(updated.id);
    }

    return {
      ...updated,
      user: flattenUser(updated.user),
    };
  }

  async updateStatus(driverId: string, status: DriverStatus) {
    if (!MANUAL_DRIVER_STATUSES.has(status)) {
      throw new BadRequestException('Driver status can only be ONLINE or OFFLINE');
    }

    return this.prisma.driver.update({
      where: { id: driverId },
      data: { status },
    });
  }

  private async calculateFinalAmountLkr(wasteCategoryId: string, weightKg: number) {
    const pricing = await this.prisma.pricing.findUnique({
      where: { wasteCategoryId },
    });
    return calculateMidpointAmountLkr(weightKg, pricing);
  }

  private async recordStatusHistory(
    bookingId: string,
    fromStatus: BookingStatus,
    toStatus: BookingStatus,
    driverId: string,
  ) {
    await this.prisma.bookingStatusHistory.create({
      data: {
        bookingId,
        fromStatus,
        toStatus,
        changedById: driverId,
        changedByRole: Role.DRIVER,
      },
    });
  }
}
