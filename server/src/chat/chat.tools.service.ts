import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { BookingStatus, Role } from '@prisma/client';
import { normalizeBookingStatus } from '../bookings/booking-status';
import { flattenUser, USER_PROFILE_INCLUDE } from '../common/utils/user.utils';
import { normalizeWasteName } from '../lib/wasteTypeUtils';
import {
  BASE_POINT_RATES,
  E_WASTE_BONUS_POINTS,
  MULTIPLIERS,
} from '../rewards/points-calculator';
import { RewardsService } from '../rewards/rewards.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthContext } from './chat.types';

const CUSTOMER_PENDING_STATUSES: BookingStatus[] = [
  BookingStatus.CREATED,
  BookingStatus.SCHEDULED,
  BookingStatus.ASSIGNED,
  BookingStatus.IN_PROGRESS,
];

const DRIVER_ACTIVE_STATUSES = new Set<BookingStatus>([
  BookingStatus.ASSIGNED,
  BookingStatus.IN_PROGRESS,
]);

function isAdminRole(role: AuthContext['role']) {
  return role === Role.ADMIN || role === Role.SUPER_ADMIN;
}

@Injectable()
export class ChatToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rewardsService: RewardsService,
  ) {}

  async getCurrentUserProfile(auth: AuthContext) {
    const userId = this.requireAuth(auth);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: USER_PROFILE_INCLUDE,
    });
    if (!user) throw new NotFoundException('User profile not found');

    const flat = flattenUser(user);
    return {
      id: flat.id,
      role: flat.role,
      email: flat.email,
      fullName: flat.fullName,
      phone: flat.phone,
      approved: flat.approved ?? null,
      totalPoints: user.totalPoints ?? null,
      createdAt: flat.createdAt,
    };
  }

  async getUserBookings(
    userId: string,
    auth: AuthContext,
    pendingOnly = false,
  ) {
    const authUserId = this.requireAuth(auth);
    this.requireRole(auth, [Role.CUSTOMER], 'getUserBookings');
    if (authUserId !== userId) {
      throw new ForbiddenException('Users can only access their own bookings');
    }

    const where: any = { userId };
    if (pendingOnly) {
      where.status = { in: CUSTOMER_PENDING_STATUSES };
    }

    const bookings = await this.prisma.booking.findMany({
      where,
      include: {
        wasteCategory: true,
        driver: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });

    const pendingCount = await this.prisma.booking.count({
      where: {
        userId,
        status: { in: CUSTOMER_PENDING_STATUSES },
      },
    });

    return {
      total: bookings.length,
      pendingCount,
      items: bookings.map((booking) => ({
        id: booking.id,
        status: normalizeBookingStatus(booking.status),
        scheduledDate: booking.scheduledDate,
        scheduledTimeSlot: booking.scheduledTimeSlot,
        city: booking.city,
        wasteCategory: booking.wasteCategory?.name ?? 'Unknown',
        estimatedAmountRange: [
          booking.estimatedMinAmount,
          booking.estimatedMaxAmount,
        ],
        finalAmountLkr: booking.finalAmountLkr,
        driver: booking.driver
          ? {
              id: booking.driver.id,
              fullName: booking.driver.fullName,
              phone: booking.driver.phone,
            }
          : null,
      })),
    };
  }

  async getUserRewards(userId: string, auth: AuthContext) {
    const authUserId = this.requireAuth(auth);
    this.requireRole(auth, [Role.CUSTOMER], 'getUserRewards');
    if (authUserId !== userId) {
      throw new ForbiddenException('Users can only access their own rewards');
    }

    return this.rewardsService.getMyRewards(userId);
  }

  async getUserNotifications(userId: string, auth: AuthContext) {
    const authUserId = this.requireAuth(auth);
    if (authUserId !== userId) {
      throw new ForbiddenException(
        'Users can only access their own notifications',
      );
    }

    const notifications = await this.prisma.notification.findMany({
      where: {
        OR: [{ userId }, { userId: null }],
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    const latest = notifications.slice(0, 10);
    const unreadCount = notifications.filter((item) => !item.isRead).length;
    return {
      unreadCount,
      totalRecent: latest.length,
      items: latest.map((item) => ({
        id: item.id,
        title: item.title,
        level: item.level,
        isRead: item.isRead,
        createdAt: item.createdAt,
        bookingId: item.bookingId,
      })),
    };
  }

  async getDriverAssignedBookings(driverId: string, auth: AuthContext) {
    const authUserId = this.requireAuth(auth);
    this.requireRole(auth, [Role.DRIVER], 'getDriverAssignedBookings');
    if (authUserId !== driverId) {
      throw new ForbiddenException(
        'Drivers can only access bookings assigned to themselves',
      );
    }

    const bookings = await this.prisma.booking.findMany({
      where: { driverId },
      include: {
        wasteCategory: true,
        user: {
          include: USER_PROFILE_INCLUDE,
        },
      },
      orderBy: { scheduledDate: 'asc' },
      take: 15,
    });

    return {
      total: bookings.length,
      activeCount: bookings.filter((booking) =>
        DRIVER_ACTIVE_STATUSES.has(normalizeBookingStatus(booking.status)),
      ).length,
      items: bookings.map((booking) => {
        const flatUser = flattenUser(booking.user);
        return {
          id: booking.id,
          status: normalizeBookingStatus(booking.status),
          scheduledDate: booking.scheduledDate,
          scheduledTimeSlot: booking.scheduledTimeSlot,
          city: booking.city,
          addressLine1: booking.addressLine1,
          wasteCategory: booking.wasteCategory?.name ?? 'Unknown',
          customer: {
            id: flatUser.id,
            fullName: flatUser.fullName,
            phone: flatUser.phone,
          },
        };
      }),
    };
  }

  async getAdminBookingSummary(auth: AuthContext) {
    this.requireAuth(auth);
    this.requireRole(
      auth,
      [Role.ADMIN, Role.SUPER_ADMIN],
      'getAdminBookingSummary',
    );

    const [total, grouped, unassigned] = await Promise.all([
      this.prisma.booking.count(),
      this.prisma.booking.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      this.prisma.booking.count({
        where: {
          driverId: null,
          status: {
            in: [BookingStatus.CREATED, BookingStatus.SCHEDULED],
          },
        },
      }),
    ]);

    const countsByStatus = grouped.reduce<Record<string, number>>(
      (acc, row) => {
        acc[normalizeBookingStatus(row.status)] =
          (acc[normalizeBookingStatus(row.status)] ?? 0) + row._count.status;
        return acc;
      },
      {},
    );

    const pendingCount =
      (countsByStatus[BookingStatus.CREATED] ?? 0) +
      (countsByStatus[BookingStatus.ASSIGNED] ?? 0) +
      (countsByStatus[BookingStatus.IN_PROGRESS] ?? 0);

    return {
      totalBookings: total,
      pendingPickups: pendingCount,
      unassignedBookings: unassigned,
      countsByStatus,
    };
  }

  async getWasteTypesAndRates() {
    const categories = await this.prisma.wasteCategory.findMany({
      where: { isActive: true },
      include: { pricing: true },
      orderBy: { name: 'asc' },
    });

    return categories.map((category) => {
      const pricing = category.pricing?.isActive ? category.pricing : null;
      const minPriceLkrPerKg = pricing?.minPriceLkrPerKg ?? null;
      const maxPriceLkrPerKg = pricing?.maxPriceLkrPerKg ?? null;
      const ratePerKg =
        minPriceLkrPerKg !== null && maxPriceLkrPerKg !== null
          ? Math.round(((minPriceLkrPerKg + maxPriceLkrPerKg) / 2) * 100) / 100
          : null;

      return {
        id: category.id,
        name: category.name,
        slug: (category as any).slug ?? normalizeWasteName(category.name),
        minPriceLkrPerKg,
        maxPriceLkrPerKg,
        ratePerKg,
      };
    });
  }

  async getRewardRules() {
    return {
      baseRates: {
        plastic: BASE_POINT_RATES.plastic,
        metal: BASE_POINT_RATES.metal,
      },
      eWasteBonus: E_WASTE_BONUS_POINTS,
      multipliers: {
        weeklyStreak: MULTIPLIERS.weekly,
        firstBooking: MULTIPLIERS.firstBooking,
        standard: MULTIPLIERS.standard,
      },
      multiplierPolicy: 'Use highest applicable multiplier only.',
      awardCondition:
        'Points are awarded when booking status becomes COMPLETED.',
      formula: 'round((basePoints + bonusPoints) * multiplier)',
    };
  }

  private requireAuth(auth: AuthContext) {
    if (!auth.isAuthenticated || !auth.userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return auth.userId;
  }

  private requireRole(
    auth: AuthContext,
    allowedRoles: Role[],
    toolName: string,
  ) {
    const role = auth.role;
    const hasRole = role !== 'GUEST' && allowedRoles.includes(role);
    if (!hasRole) {
      const allowed = allowedRoles.join(', ');
      const reason =
        isAdminRole(role) && toolName.startsWith('getUser')
          ? 'Admin role cannot use customer-scoped tool without impersonation.'
          : `Required role: ${allowed}`;
      throw new ForbiddenException(`${toolName} forbidden. ${reason}`);
    }
  }
}
