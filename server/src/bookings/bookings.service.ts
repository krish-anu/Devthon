import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionLogger } from '../common/logger/transaction-logger.service';
import { BookingsQueryDto } from './dto/bookings-query.dto';
import { CreateBookingDto } from './dto/create-booking.dto';

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private transactionLogger: TransactionLogger,
  ) {}

  async list(userId: string, query: BookingsQueryDto) {
    this.transactionLogger.logTransaction('booking.list.start', {
      userId,
      query,
    });
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;

    const where: any = { userId };
    if (query.status) where.status = query.status;
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
      return { items, total, page, pageSize };
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
      return booking;
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
      const booking = await this.prisma.booking.create({
        data: {
          userId,
          wasteCategoryId: dto.wasteCategoryId,
          estimatedWeightRange: dto.estimatedWeightRange,
          estimatedMinAmount: dto.estimatedMinAmount,
          estimatedMaxAmount: dto.estimatedMaxAmount,
          addressLine1: dto.addressLine1,
          city: dto.city,
          postalCode: dto.postalCode,
          specialInstructions: dto.specialInstructions,
          scheduledDate: new Date(dto.scheduledDate),
          scheduledTimeSlot: dto.scheduledTimeSlot,
          status: BookingStatus.SCHEDULED,
        },
      });
      this.transactionLogger.logTransaction('booking.create.success', {
        bookingId: booking.id,
        userId,
        scheduledDate: booking.scheduledDate?.toISOString(),
        amountRange: [booking.estimatedMinAmount, booking.estimatedMaxAmount],
      });
      return booking;
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
      return updated;
    } catch (err) {
      this.transactionLogger.logError('booking.cancel.failure', err as Error, {
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
        where: { userId, status: BookingStatus.SCHEDULED },
        include: { wasteCategory: true, driver: true },
        orderBy: { scheduledDate: 'asc' },
      });
      this.transactionLogger.logTransaction('booking.pending.success', {
        userId,
        count: results.length,
      });
      return results;
    } catch (err) {
      this.transactionLogger.logError('booking.pending.failure', err as Error, {
        userId,
      });
      throw err;
    }
  }
}
