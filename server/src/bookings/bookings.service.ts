import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, NotificationLevel, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../common/supabase/supabase.service';
import { TransactionLogger } from '../common/logger/transaction-logger.service';
import { PushService } from '../notifications/push.service';
import { BookingsQueryDto } from './dto/bookings-query.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import {
  BookingImageScreeningResult,
  BookingImageScreeningService,
} from './booking-image-screening.service';
import {
  expandBookingStatusFilter,
  getTransitionError,
  isLegacyBookingStatus,
  normalizeBookingStatus,
} from './booking-status';

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private supabaseService: SupabaseService,
    private transactionLogger: TransactionLogger,
    private pushService: PushService,
    private config: ConfigService,
    private bookingImageScreeningService: BookingImageScreeningService,
  ) {}

  async list(userId: string, query: BookingsQueryDto) {
    this.transactionLogger.logTransaction('booking.list.start', {
      userId,
      query,
    });
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;

    const where: any = { userId };
    if (query.status) {
      where.status = { in: expandBookingStatusFilter(query.status) };
    }
    if (query.category) where.wasteCategoryId = query.category;
    if (query.from || query.to) {
      where.scheduledDate = {};
      if (query.from) where.scheduledDate.gte = new Date(query.from);
      if (query.to) where.scheduledDate.lte = new Date(query.to);
    }
    if (query.search) {
      where.OR = [
        { id: { contains: query.search, mode: 'insensitive' } },
        { addressLine1: { contains: query.search, mode: 'insensitive' } },
        { city: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    try {
      const [items, total] = await Promise.all([
        this.prisma.booking.findMany({
          where,
          include: { wasteCategory: true, driver: true },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.prisma.booking.count({ where }),
      ]);
      this.transactionLogger.logTransaction('booking.list.success', {
        userId,
        count: items.length,
        total,
      });
      return {
        items: items.map((item) => this.normalizeBookingForRead(item)),
        total,
        page,
        pageSize,
      };
    } catch (err) {
      this.transactionLogger.logError('booking.list.failure', err as Error, {
        userId,
      });
      throw err;
    }
  }

  async getById(userId: string, id: string) {
    this.transactionLogger.logTransaction('booking.get.start', {
      userId,
      bookingId: id,
    });
    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id },
        include: { wasteCategory: true, driver: true },
      });
      if (!booking) throw new NotFoundException('Booking not found');
      if (booking.userId !== userId) throw new ForbiddenException();
      this.transactionLogger.logTransaction('booking.get.success', {
        userId,
        bookingId: id,
      });
      return this.normalizeBookingForRead(booking);
    } catch (err) {
      this.transactionLogger.logError('booking.get.failure', err as Error, {
        userId,
        bookingId: id,
      });
      throw err;
    }
  }

  async create(userId: string, dto: CreateBookingDto) {
    this.transactionLogger.logTransaction('booking.create.start', {
      userId,
      dto,
    });
    try {
      // Create one booking per selected item (category + quantity)
      const created = await Promise.all(
        dto.items.map(async (it) => {
          const pricing = await this.prisma.pricing.findUnique({
            where: { wasteCategoryId: it.wasteCategoryId },
          });
          const minPerKg = pricing?.minPriceLkrPerKg ?? 0;
          const maxPerKg = pricing?.maxPriceLkrPerKg ?? 0;
          const estimatedMinAmount = minPerKg * it.quantityKg;
          const estimatedMaxAmount = maxPerKg * it.quantityKg;
          const estimatedWeightRange = `${it.quantityKg} kg`;

          const booking = await this.prisma.booking.create({
            data: {
              userId,
              wasteCategoryId: it.wasteCategoryId,
              estimatedWeightRange,
              estimatedMinAmount,
              estimatedMaxAmount,
              addressLine1: dto.addressLine1,
              city: dto.city,
              postalCode: dto.postalCode,
              imageUrls: [...(it.images ?? []), ...(dto.images ?? [])],
              specialInstructions: dto.specialInstructions,
              scheduledDate: new Date(dto.scheduledDate),
              scheduledTimeSlot: dto.scheduledTimeSlot,
              lat: dto.lat,
              lng: dto.lng,
              status: BookingStatus.CREATED,
            },
          });
          this.transactionLogger.logTransaction('booking.create.success', {
            bookingId: booking.id,
            userId,
            scheduledDate: booking.scheduledDate?.toISOString(),
            amountRange: [
              booking.estimatedMinAmount,
              booking.estimatedMaxAmount,
            ],
          });

          // Sync booking to Supabase DB
          const supabaseData: any = {
            id: booking.id,
            userId: booking.userId,
            wasteCategoryId: booking.wasteCategoryId,
            estimatedWeightRange: booking.estimatedWeightRange,
            estimatedMinAmount: booking.estimatedMinAmount,
            estimatedMaxAmount: booking.estimatedMaxAmount,
            addressLine1: booking.addressLine1,
            city: booking.city,
            postalCode: booking.postalCode,
            scheduledDate: booking.scheduledDate,
            scheduledTimeSlot: booking.scheduledTimeSlot,
            status: booking.status,
          };

          // Add location if lat/lng provided
          if (dto.lat !== undefined && dto.lng !== undefined) {
            supabaseData.location = `SRID=4326;POINT(${dto.lng} ${dto.lat})`;
          }

          supabaseData.imageUrls = booking.imageUrls ?? [];
          await this.supabaseService.upsertRow('bookings', supabaseData);

          return booking;
        }),
      );

      // Send push notification for each created booking
      for (const booking of created) {
        const category = await this.prisma.wasteCategory.findUnique({
          where: { id: booking.wasteCategoryId },
        });
        this.pushService
          .notify(userId, {
            title: 'Booking confirmed ✅',
            body: `Your ${category?.name ?? 'waste'} pickup on ${new Date(booking.scheduledDate).toLocaleDateString()} at ${booking.scheduledTimeSlot} is confirmed.`,
            level: NotificationLevel.SUCCESS,
            bookingId: booking.id,
            url: `/users/bookings/${booking.id}`,
          })
          .catch(() => {});

        void this.notifyAdminsForNonWasteImages(booking, category?.name).catch(
          (error) => {
            this.transactionLogger.logError(
              'booking.image.screening.failure',
              error instanceof Error ? error : new Error(String(error)),
              {
                bookingId: booking.id,
                userId: booking.userId,
              },
            );
          },
        );
      }

      return created.map((item) => this.normalizeBookingForRead(item));
    } catch (err) {
      this.transactionLogger.logError('booking.create.failure', err as Error, {
        userId,
        dto,
      });
      throw err;
    }
  }

  async cancel(userId: string, id: string) {
    this.transactionLogger.logTransaction('booking.cancel.start', {
      userId,
      bookingId: id,
    });
    try {
      const booking = await this.prisma.booking.findUnique({ where: { id } });
      if (!booking) throw new NotFoundException('Booking not found');
      if (booking.userId !== userId) throw new ForbiddenException();
      const updated = await this.prisma.booking.update({
        where: { id },
        data: { status: BookingStatus.CANCELLED },
      });
      this.transactionLogger.logTransaction('booking.cancel.success', {
        userId,
        bookingId: id,
      });

      // Sync status change to Supabase DB
      await this.supabaseService.upsertRow('bookings', {
        id: updated.id,
        status: updated.status,
      });

      // Send cancellation push notification
      this.pushService
        .notify(userId, {
          title: 'Booking cancelled',
          body: `Your booking #${id.slice(0, 8)} has been cancelled.`,
          level: NotificationLevel.WARNING,
          bookingId: id,
          url: `/users/bookings/${id}`,
        })
        .catch(() => {});

      return this.normalizeBookingForRead(updated);
    } catch (err) {
      this.transactionLogger.logError('booking.cancel.failure', err as Error, {
        userId,
        bookingId: id,
      });
      throw err;
    }
  }

  async delete(userId: string, id: string, role: string) {
    this.transactionLogger.logTransaction('booking.delete.start', {
      userId,
      bookingId: id,
      role,
    });

    try {
      const booking = await this.prisma.booking.findUnique({ where: { id } });
      if (!booking) throw new NotFoundException('Booking not found');

      // Only the owner or admins can delete a booking
      if (
        booking.userId !== userId &&
        role !== 'ADMIN' &&
        role !== 'SUPER_ADMIN'
      ) {
        throw new ForbiddenException();
      }

      await this.prisma.booking.delete({ where: { id } });

      this.transactionLogger.logTransaction('booking.delete.success', {
        userId,
        bookingId: id,
      });

      // Send deletion push notification
      this.pushService
        .notify(booking.userId, {
          title: 'Booking removed',
          body: `Your booking #${id.slice(0, 8)} has been removed.`,
          level: NotificationLevel.WARNING,
          bookingId: id,
          url: `/users/bookings/${id}`,
        })
        .catch(() => {});

      return { message: 'Booking deleted' };
    } catch (err) {
      this.transactionLogger.logError('booking.delete.failure', err as Error, {
        userId,
        bookingId: id,
      });
      throw err;
    }
  }

  async pendingPickups(userId: string) {
    this.transactionLogger.logTransaction('booking.pending.start', { userId });
    try {
      const results = await this.prisma.booking.findMany({
        where: {
          userId,
          status: {
            in: [
              BookingStatus.CREATED,
              BookingStatus.SCHEDULED,
              BookingStatus.ASSIGNED,
              BookingStatus.IN_PROGRESS,
            ],
          },
        },
        include: { wasteCategory: true, driver: true },
        orderBy: { scheduledDate: 'asc' },
      });
      this.transactionLogger.logTransaction('booking.pending.success', {
        userId,
        count: results.length,
      });
      return results.map((item) => this.normalizeBookingForRead(item));
    } catch (err) {
      this.transactionLogger.logError('booking.pending.failure', err as Error, {
        userId,
      });
      throw err;
    }
  }

  async updateLocation(userId: string, id: string, lng: number, lat: number) {
    this.transactionLogger.logTransaction('booking.updateLocation.start', {
      userId,
      bookingId: id,
      lng,
      lat,
    });
    try {
      const booking = await this.prisma.booking.findUnique({ where: { id } });
      if (!booking) throw new NotFoundException('Booking not found');
      if (booking.userId !== userId) throw new ForbiddenException();

      // Update location in Supabase as geography(Point, 4326) with SRID=4326;POINT(lng lat)
      const location = `SRID=4326;POINT(${lng} ${lat})`;
      await this.supabaseService.upsertRow('bookings', {
        id,
        location,
      });

      this.transactionLogger.logTransaction('booking.updateLocation.success', {
        userId,
        bookingId: id,
        location,
      });
      return { message: 'Location updated successfully' };
    } catch (err) {
      this.transactionLogger.logError(
        'booking.updateLocation.failure',
        err as Error,
        {
          userId,
          bookingId: id,
          lng,
          lat,
        },
      );
      throw err;
    }
  }

  async updateStatus(id: string, dto: UpdateBookingStatusDto) {
    this.transactionLogger.logTransaction('booking.status.update.start', {
      bookingId: id,
      status: dto.status,
    });
    try {
      const booking = await this.prisma.booking.findUnique({ where: { id } });
      if (!booking) throw new NotFoundException('Booking not found');

      if (isLegacyBookingStatus(dto.status)) {
        throw new BadRequestException(
          `Legacy status ${dto.status} is not allowed.`,
        );
      }

      const currentStatus = normalizeBookingStatus(booking.status);
      const nextStatus = normalizeBookingStatus(dto.status);
      if (nextStatus !== currentStatus) {
        const transitionError = getTransitionError(currentStatus, nextStatus);
        if (transitionError) {
          throw new BadRequestException(transitionError);
        }
      }

      const shouldConfirm = nextStatus === BookingStatus.COMPLETED;
      const nextWeight =
        dto.actualWeightKg !== undefined
          ? dto.actualWeightKg
          : booking.actualWeightKg;
      const nextAmount =
        dto.finalAmountLkr !== undefined
          ? dto.finalAmountLkr
          : booking.finalAmountLkr;

      if (
        shouldConfirm &&
        (nextWeight === null ||
          nextWeight === undefined ||
          nextAmount === null ||
          nextAmount === undefined)
      ) {
        throw new BadRequestException(
          'Cannot complete a booking without weight and amount.',
        );
      }

      const data: any = { status: nextStatus };

      if (dto.actualWeightKg !== undefined) {
        data.actualWeightKg = dto.actualWeightKg;
      }
      if (dto.finalAmountLkr !== undefined) {
        data.finalAmountLkr = dto.finalAmountLkr;
      }
      if (shouldConfirm && !booking.confirmedAt) {
        data.confirmedAt = new Date();
      }

      const updated = await this.prisma.booking.update({
        where: { id },
        data,
      });

      await this.supabaseService.upsertRow('bookings', {
        id: updated.id,
        status: updated.status,
        actualWeightKg: updated.actualWeightKg,
        finalAmountLkr: updated.finalAmountLkr,
        confirmedAt: updated.confirmedAt,
      });

      this.transactionLogger.logTransaction('booking.status.update.success', {
        bookingId: id,
        status: updated.status,
      });

      return this.normalizeBookingForRead(updated);
    } catch (err) {
      this.transactionLogger.logError(
        'booking.status.update.failure',
        err as Error,
        { bookingId: id, status: dto.status },
      );
      throw err;
    }
  }

  private normalizeBookingForRead<T extends { status: BookingStatus }>(
    booking: T,
  ): T {
    const normalizedStatus = normalizeBookingStatus(booking.status);
    if (normalizedStatus === booking.status) return booking;
    return {
      ...booking,
      status: normalizedStatus,
    };
  }

  private async notifyAdminsForNonWasteImages(
    booking: {
      id: string;
      userId: string;
      imageUrls: string[];
    },
    expectedWasteCategory?: string | null,
  ) {
    const imageUrls = (booking.imageUrls ?? []).filter(Boolean);
    if (imageUrls.length === 0) return;

    this.transactionLogger.logTransaction('booking.image.screening.start', {
      bookingId: booking.id,
      userId: booking.userId,
      imagesCount: imageUrls.length,
      expectedWasteCategory: expectedWasteCategory ?? null,
    });

    const screeningResults =
      await this.bookingImageScreeningService.screenImages(imageUrls, {
        expectedWasteCategory,
      });
    this.transactionLogger.logTransaction('booking.image.screening.results', {
      bookingId: booking.id,
      results: screeningResults.map((result) => ({
        isWaste: result.isWaste,
        verdict: result.verdict,
        confidence: result.confidence,
        source: result.verdictSource,
        object: result.detectedObject,
      })),
    });

    const suspiciousImages = screeningResults.filter((result) =>
      this.shouldAlertForScreeningResult(result),
    );
    if (suspiciousImages.length === 0) {
      this.transactionLogger.logTransaction('booking.image.screening.clean', {
        bookingId: booking.id,
        userId: booking.userId,
      });
      return;
    }

    const admins = await this.prisma.user.findMany({
      where: {
        role: {
          in: [Role.ADMIN, Role.SUPER_ADMIN],
        },
      },
      select: { id: true },
    });
    if (admins.length === 0) {
      return;
    }

    const sampleDetection = suspiciousImages[0];
    const description = sampleDetection.detectedObject || 'unknown object';
    const confidencePct = Math.round((sampleDetection.confidence ?? 0) * 100);
    const expectedText = expectedWasteCategory
      ? ` Expected: ${expectedWasteCategory}.`
      : '';
    const reasonText = sampleDetection.reason
      ? ` Reason: ${sampleDetection.reason}.`
      : '';
    const message = `Booking #${booking.id.slice(0, 8)} has ${suspiciousImages.length} suspicious image(s). Verdict: ${sampleDetection.verdict}. Detected: ${description} (${confidencePct}% confidence).${expectedText}${reasonText}`;

    await Promise.allSettled(
      admins.map((admin) =>
        this.pushService.notify(admin.id, {
          title: 'Manual review needed: possible non-waste image',
          body: message,
          level: NotificationLevel.WARNING,
          bookingId: booking.id,
          url: '/admin/bookings',
        }),
      ),
    );

    this.transactionLogger.logTransaction(
      'booking.image.screening.non_waste_detected',
      {
        bookingId: booking.id,
        userId: booking.userId,
        nonWasteCount: suspiciousImages.length,
      },
    );
  }

  private shouldAlertForScreeningResult(result: BookingImageScreeningResult) {
    if (result.verdictSource !== 'model') return false;

    const confidence = result.confidence ?? 0;
    if (result.verdict === 'NON_WASTE') {
      return (
        confidence >= this.getNonWasteAlertConfidence() ||
        this.hasExplicitNonWasteSignal(result)
      );
    }

    if (result.verdict === 'WASTE_BUT_DIFFERENT') {
      return confidence >= this.getMismatchAlertConfidence();
    }

    if (result.verdict === 'UNCERTAIN') {
      return (
        this.shouldAlertOnUncertain() &&
        confidence >= this.getUncertainAlertConfidence()
      );
    }

    return false;
  }

  private getNonWasteAlertConfidence() {
    const configured = Number.parseFloat(
      this.config.get<string>('BOOKING_IMAGE_VISION_ALERT_CONFIDENCE') ?? '',
    );
    if (Number.isFinite(configured)) {
      return Math.max(0, Math.min(1, configured));
    }
    return 0.45;
  }

  private getMismatchAlertConfidence() {
    const configured = Number.parseFloat(
      this.config.get<string>(
        'BOOKING_IMAGE_VISION_CATEGORY_MISMATCH_CONFIDENCE',
      ) ?? '',
    );
    if (Number.isFinite(configured)) {
      return Math.max(0, Math.min(1, configured));
    }
    return 0.55;
  }

  private getUncertainAlertConfidence() {
    const configured = Number.parseFloat(
      this.config.get<string>('BOOKING_IMAGE_VISION_UNCERTAIN_CONFIDENCE') ??
        '',
    );
    if (Number.isFinite(configured)) {
      return Math.max(0, Math.min(1, configured));
    }
    return 0.7;
  }

  private shouldAlertOnUncertain() {
    const configured = this.config.get<string>(
      'BOOKING_IMAGE_VISION_ALERT_ON_UNCERTAIN',
    );
    if (!configured) return true;
    const normalized = configured.trim().toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(normalized);
  }

  private hasExplicitNonWasteSignal(result: BookingImageScreeningResult) {
    const text = `${result.detectedObject} ${result.reason}`.toLowerCase();
    const keywords = [
      'person',
      'human',
      'selfie',
      'portrait',
      'face',
      'pet',
      'dog',
      'cat',
      'animal',
      'landscape',
      'scenery',
      'sky',
      'beach',
      'mountain',
      'document',
      'screenshot',
      'screen',
      'monitor',
      'laptop',
      'phone',
      'not waste',
      'non-waste',
      'irrelevant',
      'unrelated',
    ];

    return keywords.some((token) => text.includes(token));
  }
}
