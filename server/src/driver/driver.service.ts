import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, DriverStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { flattenUser, USER_PROFILE_INCLUDE } from '../common/utils/user.utils';
import { calculateMidpointAmountLkr } from '../bookings/booking-amount';
import {
  getRoleTransitionError,
  isLegacyBookingStatus,
  normalizeBookingStatus,
} from '../bookings/booking-status';
import { PushService } from '../notifications/push.service';
import { CollectDriverBookingDto } from './dto/collect-driver-booking.dto';
import { CancelDriverBookingDto } from './dto/cancel-driver-booking.dto';
import { UpdateDriverBookingDto } from './dto/update-driver-booking.dto';

const MANUAL_DRIVER_STATUSES = new Set<DriverStatus>([
  DriverStatus.ONLINE,
  DriverStatus.OFFLINE,
]);

@Injectable()
export class DriverService {
  constructor(
    private prisma: PrismaService,
    private pushService: PushService,
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

    return bookings.map((booking) => this.toDriverBookingResponse(booking));
  }

  async getBookingById(driverId: string, bookingId: string) {
    const booking = await this.getAssignedBooking(driverId, bookingId);
    return this.toDriverBookingResponse(booking);
  }

  async startPickup(driverId: string, bookingId: string) {
    const booking = await this.getAssignedBooking(driverId, bookingId);
    const currentStatus = normalizeBookingStatus(booking.status);
    const nextStatus = BookingStatus.IN_PROGRESS;

    const transitionError = getRoleTransitionError(
      'DRIVER',
      currentStatus,
      nextStatus,
    );
    if (transitionError) throw new BadRequestException(transitionError);

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: nextStatus },
      include: {
        user: {
          include: USER_PROFILE_INCLUDE,
        },
        wasteCategory: true,
      },
    });

    await this.recordStatusHistory(
      booking.id,
      currentStatus,
      nextStatus,
      driverId,
    );
    await this.prisma.driver.update({
      where: { id: driverId },
      data: { status: DriverStatus.ON_PICKUP },
    });

    return this.toDriverBookingResponse(updated);
  }

  async collectBooking(
    driverId: string,
    bookingId: string,
    dto: CollectDriverBookingDto,
  ) {
    const booking = await this.getAssignedBooking(driverId, bookingId);
    const currentStatus = normalizeBookingStatus(booking.status);
    const nextStatus = BookingStatus.COLLECTED;

    const transitionError = getRoleTransitionError(
      'DRIVER',
      currentStatus,
      nextStatus,
    );
    if (transitionError) throw new BadRequestException(transitionError);

    const categoryForPricing = dto.wasteCategoryId ?? booking.wasteCategoryId;
    const amountLkr = await this.calculateFinalAmountLkr(
      categoryForPricing,
      dto.weightKg,
    );
    if (amountLkr === null) {
      throw new BadRequestException(
        'Pricing is not configured for this waste category.',
      );
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: nextStatus,
        actualWeightKg: dto.weightKg,
        finalAmountLkr: amountLkr,
        wasteCategoryId: dto.wasteCategoryId ?? booking.wasteCategoryId,
      },
      include: {
        user: {
          include: USER_PROFILE_INCLUDE,
        },
        wasteCategory: true,
      },
    });

    const statusChanged = currentStatus !== nextStatus;
    if (statusChanged) {
      await this.recordStatusHistory(
        booking.id,
        currentStatus,
        nextStatus,
        driverId,
      );
      await this.prisma.driver.update({
        where: { id: driverId },
        data: {
          status: DriverStatus.ONLINE,
          pickupCount: { increment: 1 },
        },
      });
    }

    if (statusChanged) {
      const wasteTypeName = updated.wasteCategory?.name ?? 'Waste';
      this.pushService
        .notify(booking.userId, {
          title: 'Pickup collected',
          body: `Pickup collected: ${wasteTypeName}, ${dto.weightKg.toFixed(2)} kg. Amount due: LKR ${amountLkr.toFixed(2)}.`,
          bookingId: booking.id,
          url: `/users/bookings/${booking.id}`,
        })
        .catch(() => {});
    }

    return this.toDriverBookingResponse(updated);
  }

  async cancelBooking(
    driverId: string,
    bookingId: string,
    dto?: CancelDriverBookingDto,
  ) {
    const booking = await this.getAssignedBooking(driverId, bookingId);
    const currentStatus = normalizeBookingStatus(booking.status);
    const nextStatus = BookingStatus.CANCELLED;

    const transitionError = getRoleTransitionError(
      'DRIVER',
      currentStatus,
      nextStatus,
    );
    if (transitionError) throw new BadRequestException(transitionError);

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: nextStatus },
      include: {
        user: {
          include: USER_PROFILE_INCLUDE,
        },
        wasteCategory: true,
      },
    });

    await this.recordStatusHistory(
      booking.id,
      currentStatus,
      nextStatus,
      driverId,
    );
    await this.prisma.driver.update({
      where: { id: driverId },
      data: { status: DriverStatus.ONLINE },
    });

    const messageSuffix = dto?.reason?.trim()
      ? ` Reason: ${dto.reason.trim()}.`
      : '';
    this.pushService
      .notify(booking.userId, {
        title: 'Booking cancelled',
        body: `Booking #${booking.id.slice(0, 8)} was cancelled by the driver.${messageSuffix}`,
        bookingId: booking.id,
        url: `/users/bookings/${booking.id}`,
      })
      .catch(() => {});

    return this.toDriverBookingResponse(updated);
  }

  async updateBooking(
    driverId: string,
    bookingId: string,
    dto: UpdateDriverBookingDto,
  ) {
    if (dto.status && isLegacyBookingStatus(dto.status)) {
      throw new BadRequestException(
        `Legacy status ${dto.status} is not allowed.`,
      );
    }

    if (dto.status === BookingStatus.COMPLETED) {
      throw new BadRequestException(
        'Driver cannot mark bookings as completed.',
      );
    }

    if (dto.status === BookingStatus.IN_PROGRESS) {
      return this.startPickup(driverId, bookingId);
    }

    if (dto.status === BookingStatus.CANCELLED) {
      return this.cancelBooking(driverId, bookingId);
    }

    if (dto.status === BookingStatus.COLLECTED) {
      if (dto.actualWeightKg === null || dto.actualWeightKg === undefined) {
        throw new BadRequestException(
          'Weight (kg) is required when marking a booking as collected.',
        );
      }
      return this.collectBooking(driverId, bookingId, {
        weightKg: dto.actualWeightKg,
        wasteCategoryId: dto.wasteCategoryId,
      });
    }

    if (dto.actualWeightKg !== null && dto.actualWeightKg !== undefined) {
      return this.collectBooking(driverId, bookingId, {
        weightKg: dto.actualWeightKg,
        wasteCategoryId: dto.wasteCategoryId,
      });
    }

    throw new BadRequestException(
      'Use start, collect, or cancel actions to update bookings.',
    );
  }

  async updateStatus(driverId: string, status: DriverStatus) {
    if (!MANUAL_DRIVER_STATUSES.has(status)) {
      throw new BadRequestException(
        'Driver status can only be ONLINE or OFFLINE',
      );
    }

    return this.prisma.driver.update({
      where: { id: driverId },
      data: { status },
    });
  }

  private async getAssignedBooking(driverId: string, bookingId: string) {
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
    if (booking.driverId !== driverId) {
      throw new ForbiddenException('Booking is not assigned to this driver');
    }

    return booking;
  }

  private async calculateFinalAmountLkr(
    wasteCategoryId: string,
    weightKg: number,
  ) {
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

  private toDriverBookingResponse<
    T extends { status: BookingStatus; user: any },
  >(booking: T): T {
    return {
      ...booking,
      status: normalizeBookingStatus(booking.status),
      user: flattenUser(booking.user),
    };
  }
}
