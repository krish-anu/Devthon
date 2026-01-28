import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BookingsQueryDto } from './dto/bookings-query.dto';
import { CreateBookingDto } from './dto/create-booking.dto';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string, query: BookingsQueryDto) {
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

    return { items, total, page, pageSize };
  }

  async getById(userId: string, id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { wasteCategory: true, driver: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.userId !== userId) throw new ForbiddenException();
    return booking;
  }

  async create(userId: string, dto: CreateBookingDto) {
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
    return booking;
  }

  async cancel(userId: string, id: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.userId !== userId) throw new ForbiddenException();
    return this.prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.CANCELLED },
    });
  }

  async pendingPickups(userId: string) {
    return this.prisma.booking.findMany({
      where: { userId, status: BookingStatus.SCHEDULED },
      include: { wasteCategory: true, driver: true },
      orderBy: { scheduledDate: 'asc' },
    });
  }
}
