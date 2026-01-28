import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { AdminCreateDriverDto } from './dto/admin-create-driver.dto';
import { AdminUpdateDriverDto } from './dto/admin-update-driver.dto';
import { AdminUpdatePricingDto } from './dto/admin-update-pricing.dto';
import { AdminBookingsQueryDto } from './dto/admin-bookings-query.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  private sanitizeUser(user: any) {
    if (!user) return user;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, refreshTokenHash, ...safe } = user;
    return safe;
  }

  async getMetrics() {
    const [revenueAgg, totalUsers, activeDrivers, pendingPickups] =
      await Promise.all([
        this.prisma.paymentTransaction.aggregate({
          _sum: { amountLkr: true },
        }),
        this.prisma.user.count(),
        this.prisma.driver.count({
          where: { status: { in: ['ONLINE', 'ON_PICKUP'] } },
        }),
        this.prisma.booking.count({ where: { status: 'SCHEDULED' } }),
      ]);

    const last7Days = Array.from({ length: 7 }).map((_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      return date;
    });

    const transactions = await this.prisma.paymentTransaction.findMany({
      where: {
        createdAt: {
          gte: new Date(last7Days[0].toISOString().slice(0, 10)),
        },
      },
    });

    const revenueByDay = last7Days.map((date) => {
      const key = date.toISOString().slice(0, 10);
      const sum = transactions
        .filter((t) => t.createdAt.toISOString().slice(0, 10) === key)
        .reduce((acc, cur) => acc + cur.amountLkr, 0);
      return { date: key, revenue: sum };
    });

    const bookingsByCategory = await this.prisma.booking.groupBy({
      by: ['wasteCategoryId'],
      _count: { wasteCategoryId: true },
    });
    const categories = await this.prisma.wasteCategory.findMany();
    const wasteDistribution = bookingsByCategory.map((item) => ({
      name: categories.find((c) => c.id === item.wasteCategoryId)?.name ?? 'Other',
      value: item._count.wasteCategoryId,
    }));

    const recentActivity = await this.prisma.booking.findMany({
      take: 6,
      orderBy: { createdAt: 'desc' },
      include: { user: true, wasteCategory: true },
    });

    return {
      totals: {
        totalRevenue: revenueAgg._sum.amountLkr ?? 0,
        totalUsers,
        activeDrivers,
        pendingPickups,
      },
      revenueByDay,
      wasteDistribution,
      recentActivity,
    };
  }

  async listUsers(search?: string) {
    const users = await this.prisma.user.findMany({
      where: search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { bookings: true },
        },
      },
    });
    return users.map((user) => this.sanitizeUser(user));
  }

  async createUser(dto: AdminCreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        role: dto.role,
        type: dto.type,
        status: dto.status ?? 'ACTIVE',
      },
    });
    return this.sanitizeUser(user);
  }

  async updateUser(id: string, dto: AdminUpdateUserDto) {
    const data: any = { ...dto };
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
      delete data.password;
    }
    const user = await this.prisma.user.update({ where: { id }, data });
    return this.sanitizeUser(user);
  }

  async deleteUser(id: string) {
    await this.prisma.user.delete({ where: { id } });
    return { success: true };
  }

  async listDrivers() {
    return this.prisma.driver.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createDriver(dto: AdminCreateDriverDto) {
    return this.prisma.driver.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        rating: dto.rating ?? 4.6,
        pickupCount: dto.pickupCount ?? 0,
        vehicleType: dto.vehicleType,
        status: dto.status ?? 'OFFLINE',
      },
    });
  }

  async updateDriver(id: string, dto: AdminUpdateDriverDto) {
    return this.prisma.driver.update({ where: { id }, data: dto });
  }

  async deleteDriver(id: string) {
    await this.prisma.driver.delete({ where: { id } });
    return { success: true };
  }

  async listBookings(query: AdminBookingsQueryDto) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.userId) where.userId = query.userId;
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }
    if (query.search) {
      where.OR = [
        { id: { contains: query.search, mode: 'insensitive' } },
        { addressLine1: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.booking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { user: true, wasteCategory: true, driver: true },
    });
  }

  async updatePricing(dto: AdminUpdatePricingDto) {
    const updates = await Promise.all(
      dto.items.map((item) =>
        this.prisma.pricing.upsert({
          where: { wasteCategoryId: item.wasteCategoryId },
          create: {
            wasteCategoryId: item.wasteCategoryId,
            minPriceLkrPerKg: item.minPriceLkrPerKg,
            maxPriceLkrPerKg: item.maxPriceLkrPerKg,
            isActive: item.isActive ?? true,
          },
          update: {
            minPriceLkrPerKg: item.minPriceLkrPerKg,
            maxPriceLkrPerKg: item.maxPriceLkrPerKg,
            isActive: item.isActive ?? true,
          },
        }),
      ),
    );
    return { items: updates };
  }

  async listPricing() {
    return this.prisma.pricing.findMany({
      include: { wasteCategory: true },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
