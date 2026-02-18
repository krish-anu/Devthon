import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BookingStatus, CustomerType, NotificationLevel, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../notifications/push.service';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { AdminCreateDriverDto } from './dto/admin-create-driver.dto';
import { AdminUpdateDriverDto } from './dto/admin-update-driver.dto';
import { AdminUpdatePricingDto } from './dto/admin-update-pricing.dto';
import { AdminUpdateBookingDto } from './dto/admin-update-booking.dto';
import { AdminBookingsQueryDto } from './dto/admin-bookings-query.dto';
import { AdminCreateWasteCategoryDto } from './dto/admin-create-waste-category.dto';
import { AdminUpdateWasteCategoryDto } from './dto/admin-update-waste-category.dto';
import * as bcrypt from 'bcrypt';
import { flattenUser, USER_PROFILE_INCLUDE } from '../common/utils/user.utils';
import { RewardsService } from '../rewards/rewards.service';
import { UpdateBookingStatusDto } from '../bookings/dto/update-booking-status.dto';
import { calculateMidpointAmountLkr } from '../bookings/booking-amount';
import { getTransitionError } from '../bookings/booking-status';

type ActorContext = { sub: string; role: Role };
const CLOSED_BOOKING_STATUSES = new Set<BookingStatus>([
  BookingStatus.COMPLETED,
  BookingStatus.CANCELLED,
  BookingStatus.REFUNDED,
]);
const PRE_ASSIGN_BOOKING_STATUSES = new Set<BookingStatus>([
  BookingStatus.CREATED,
  BookingStatus.SCHEDULED,
]);
const DRIVER_REQUIRED_BOOKING_STATUSES = new Set<BookingStatus>([
  BookingStatus.ASSIGNED,
  BookingStatus.IN_PROGRESS,
  BookingStatus.COLLECTED,
  BookingStatus.PAID,
  BookingStatus.COMPLETED,
]);
const BOOKING_STATUSES = Object.values(BookingStatus) as BookingStatus[];
const LEGACY_SAFE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.SCHEDULED,
  BookingStatus.COLLECTED,
  BookingStatus.PAID,
  BookingStatus.COMPLETED,
  BookingStatus.CANCELLED,
  BookingStatus.REFUNDED,
];

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private readonly bookingStatusAvailability = new Map<BookingStatus, boolean>();
  private bookingStatusAvailabilityLoaded = false;
  private bookingStatusAvailabilityKnown = false;

  constructor(
    private prisma: PrismaService,
    private pushService: PushService,
    private rewardsService: RewardsService,
  ) {}

  async getMetrics() {
    const [
      revenueAgg,
      revenueCount,
      completedAgg,
      totalUsers,
      activeDrivers,
      pendingPickups,
    ] = await Promise.all([
      this.prisma.paymentTransaction.aggregate({
        _sum: { amountLkr: true },
      }),
      this.prisma.paymentTransaction.count(),
      this.prisma.booking.aggregate({
        _sum: { finalAmountLkr: true },
        where: { status: BookingStatus.COMPLETED },
      }),
      this.prisma.user.count(),
      this.prisma.driver.count({
        where: { status: { in: ['ONLINE', 'ON_PICKUP'] } },
      }),
      this.prisma.booking.count({
        where: { status: { in: ['SCHEDULED', 'ASSIGNED', 'IN_PROGRESS'] } },
      }),
    ]);

    const last7Days = Array.from({ length: 7 }).map((_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      return date;
    });

    const useTransactions = revenueCount > 0;
    const totalRevenue = useTransactions
      ? revenueAgg._sum.amountLkr ?? 0
      : completedAgg._sum.finalAmountLkr ?? 0;

    let revenueByDay: Array<{ date: string; revenue: number }> = [];

    if (useTransactions) {
      const transactions = await this.prisma.paymentTransaction.findMany({
        where: {
          createdAt: {
            gte: new Date(last7Days[0].toISOString().slice(0, 10)),
          },
        },
      });

      revenueByDay = last7Days.map((date) => {
        const key = date.toISOString().slice(0, 10);
        const sum = transactions
          .filter((t) => t.createdAt.toISOString().slice(0, 10) === key)
          .reduce((acc, cur) => acc + cur.amountLkr, 0);
        return { date: key, revenue: sum };
      });
    } else {
      const completed = await this.prisma.booking.findMany({
        where: {
          status: BookingStatus.COMPLETED,
          finalAmountLkr: { not: null },
          OR: [
            {
              confirmedAt: {
                gte: new Date(last7Days[0].toISOString().slice(0, 10)),
              },
            },
            {
              confirmedAt: null,
              createdAt: {
                gte: new Date(last7Days[0].toISOString().slice(0, 10)),
              },
            },
          ],
        },
        select: {
          finalAmountLkr: true,
          confirmedAt: true,
          createdAt: true,
        },
      });

      revenueByDay = last7Days.map((date) => {
        const key = date.toISOString().slice(0, 10);
        const sum = completed
          .filter((b) => (b.confirmedAt ?? b.createdAt).toISOString().slice(0, 10) === key)
          .reduce((acc, cur) => acc + (cur.finalAmountLkr ?? 0), 0);
        return { date: key, revenue: sum };
      });
    }

    const bookingsByCategory = await this.prisma.booking.groupBy({
      by: ['wasteCategoryId'],
      _count: { wasteCategoryId: true },
    });
    const categories = await this.prisma.wasteCategory.findMany();
    const wasteDistribution = bookingsByCategory.map((item) => ({
      name:
        categories.find((c) => c.id === item.wasteCategoryId)?.name ?? 'Other',
      value: item._count.wasteCategoryId,
    }));

    const recentActivity = await this.prisma.booking.findMany({
      take: 6,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { include: USER_PROFILE_INCLUDE },
        wasteCategory: true,
      },
    });

    return {
      totals: {
        totalRevenue,
        totalUsers,
        activeDrivers,
        pendingPickups,
      },
      revenueByDay,
      wasteDistribution,
      recentActivity: recentActivity.map((booking) => ({
        ...booking,
        user: flattenUser(booking.user),
      })),
    };
  }

  async listUsers(search?: string, type?: string) {
    // Build the customer filter for type
    const typeValue: CustomerType | null =
      type === 'HOUSEHOLD' || type === 'BUSINESS'
        ? (type as CustomerType)
        : null;

    const hasSearch = search?.trim().length;

    // We query users with their customer profile included
    const where: Prisma.UserWhereInput = {};

    // Only show CUSTOMER-role users in the admin users list
    where.role = 'CUSTOMER';

    if (typeValue) {
      where.customer = { type: typeValue };
    }

    if (hasSearch) {
      const term = search.trim();
      where.OR = [
        {
          customer: {
            fullName: { contains: term, mode: 'insensitive' as const },
          },
        },
        { email: { contains: term, mode: 'insensitive' as const } },
      ];
    }

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        ...USER_PROFILE_INCLUDE,
        _count: {
          select: { bookings: true },
        },
      },
    });

    return users.map((user) => ({
      ...flattenUser(user),
      _count: (user as any)._count,
    }));
  }

  async createUser(dto: AdminCreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          role: dto.role,
        },
      });

      // Create the appropriate profile based on role
      switch (dto.role) {
        case 'CUSTOMER':
          await tx.customer.create({
            data: {
              id: newUser.id,
              fullName: dto.fullName,
              phone: dto.phone,
              type: dto.type ?? 'HOUSEHOLD',
              status: dto.status ?? 'ACTIVE',
            },
          });
          break;
        case 'ADMIN':
        case 'SUPER_ADMIN':
          await tx.admin.create({
            data: {
              id: newUser.id,
              fullName: dto.fullName,
              phone: dto.phone,
            },
          });
          break;
        case 'DRIVER':
          await tx.driver.create({
            data: {
              id: newUser.id,
              fullName: dto.fullName,
              phone: dto.phone,
              vehicle: '',
            },
          });
          break;
      }

      return tx.user.findUnique({
        where: { id: newUser.id },
        include: USER_PROFILE_INCLUDE,
      });
    });

    return flattenUser(user);
  }

  async updateUser(id: string, dto: AdminUpdateUserDto) {
    const userUpdate: any = {};
    if (dto.email) userUpdate.email = dto.email;
    if (dto.role) userUpdate.role = dto.role;
    if (dto.password) {
      userUpdate.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    if (Object.keys(userUpdate).length > 0) {
      await this.prisma.user.update({ where: { id }, data: userUpdate });
    }

    // Update profile data
    const profileData: any = {};
    if (dto.fullName) profileData.fullName = dto.fullName;
    if (dto.phone) profileData.phone = dto.phone;
    if (dto.type) profileData.type = dto.type;
    if (dto.status) profileData.status = dto.status;

    if (Object.keys(profileData).length > 0) {
      const user = await this.prisma.user.findUnique({ where: { id } });
      if (user) {
        switch (user.role) {
          case 'CUSTOMER':
            const existingCustomer = await this.prisma.customer.findUnique({
              where: { id },
              select: { id: true },
            });
            if (existingCustomer) {
              await this.prisma.customer.update({
                where: { id },
                data: profileData,
              });
            } else {
              await this.prisma.customer.create({
                data: {
                  id,
                  fullName: dto.fullName ?? '',
                  phone: dto.phone ?? '',
                  type: dto.type ?? 'HOUSEHOLD',
                  status: dto.status ?? 'ACTIVE',
                  ...profileData,
                },
              });
            }
            break;
          case 'ADMIN':
          case 'SUPER_ADMIN':
            const existingAdmin = await this.prisma.admin.findUnique({
              where: { id },
              select: { id: true },
            });
            if (existingAdmin) {
              await this.prisma.admin.update({
                where: { id },
                data: {
                  fullName: profileData.fullName,
                  phone: profileData.phone,
                  address: profileData.address,
                },
              });
            } else {
              await this.prisma.admin.create({
                data: {
                  id,
                  fullName: dto.fullName ?? '',
                  phone: dto.phone ?? '',
                  address: profileData.address,
                },
              });
            }
            break;
          case 'DRIVER':
            const existingDriver = await this.prisma.driver.findUnique({
              where: { id },
              select: { id: true },
            });
            if (existingDriver) {
              await this.prisma.driver.update({
                where: { id },
                data: {
                  fullName: profileData.fullName,
                  phone: profileData.phone,
                },
              });
            } else {
              await this.prisma.driver.create({
                data: {
                  id,
                  fullName: dto.fullName ?? '',
                  phone: dto.phone ?? '',
                  vehicle: '',
                },
              });
            }
            break;
        }
      }
    }

    const updated = await this.prisma.user.findUnique({
      where: { id },
      include: USER_PROFILE_INCLUDE,
    });
    return flattenUser(updated);
  }

  async deleteUser(id: string) {
    // Delete related records first (due to foreign key constraints)
    await this.prisma.notification.deleteMany({ where: { userId: id } });
    await this.prisma.paymentTransaction.deleteMany({
      where: { booking: { userId: id } },
    });
    await this.prisma.booking.deleteMany({ where: { userId: id } });

    // Delete profile tables (they share the same ID)
    await this.prisma.customer.deleteMany({ where: { id } });
    await this.prisma.admin.deleteMany({ where: { id } });
    await this.prisma.driver.deleteMany({ where: { id } });
    await this.prisma.userPermission.deleteMany({ where: { userId: id } });
    await this.prisma.passkeyCredential.deleteMany({ where: { userId: id } });

    // Now delete the user
    await this.prisma.user.delete({ where: { id } });
    return { success: true };
  }

  async listDrivers() {
    const drivers = await this.prisma.driver.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });
    return drivers.map((d) => ({
      id: d.id,
      fullName: d.fullName,
      phone: d.phone,
      email: d.user?.email ?? '',
      rating: d.rating,
      pickupCount: d.pickupCount,
      vehicle: d.vehicle,
      status: d.status,
      approved: d.approved,
      createdAt: d.createdAt,
    }));
  }

  async createDriver(dto: AdminCreateDriverDto) {
    // Driver is now linked 1:1 with User, so we must create both
    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 10)
      : undefined;

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          role: 'DRIVER',
        },
      });

      const driver = await tx.driver.create({
        data: {
          id: user.id,
          fullName: dto.fullName,
          phone: dto.phone,
          rating: dto.rating ?? 0,
          pickupCount: dto.pickupCount ?? 0,
          vehicle: dto.vehicle,
          status: dto.status ?? 'OFFLINE',
        },
      });

      return {
        ...driver,
        email: dto.email,
      };
    });
  }

  async updateDriver(id: string, dto: AdminUpdateDriverDto) {
    const data: any = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.rating !== undefined) data.rating = dto.rating;
    if (dto.pickupCount !== undefined) data.pickupCount = dto.pickupCount;
    if (dto.vehicle !== undefined) data.vehicle = dto.vehicle;
    if (dto.status !== undefined) data.status = dto.status;

    return this.prisma.driver.update({ where: { id }, data });
  }

  async deleteDriver(id: string) {
    // Delete the driver profile, then the user record
    await this.prisma.driver.delete({ where: { id } });
    await this.prisma.user.delete({ where: { id } }).catch(() => {});
    return { success: true };
  }

  async listBookings(query: AdminBookingsQueryDto) {
    const where: Prisma.BookingWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) {
        where.createdAt.gte = new Date(query.from);
      }
      if (query.to) {
        const toDate = new Date(query.to);
        toDate.setDate(toDate.getDate() + 1);
        where.createdAt.lt = toDate;
      }
    }

    if (query.search) {
      const searchTerm = query.search.trim();
      where.OR = [
        { id: { contains: searchTerm, mode: 'insensitive' as const } },
        {
          addressLine1: { contains: searchTerm, mode: 'insensitive' as const },
        },
      ];
    }

    const bookings = await this.prisma.booking.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { include: USER_PROFILE_INCLUDE },
        wasteCategory: true,
        driver: true,
      },
    });

    return bookings.map((booking) => ({
      ...booking,
      user: flattenUser(booking.user),
    }));
  }

  async listSupportedBookingStatuses() {
    await this.loadBookingStatusAvailability();
    if (!this.bookingStatusAvailabilityKnown) {
      return LEGACY_SAFE_BOOKING_STATUSES;
    }

    return BOOKING_STATUSES.filter(
      (status) => this.bookingStatusAvailability.get(status) === true,
    );
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

  // Waste Category management
  async listWasteCategories() {
    return this.prisma.wasteCategory.findMany({ orderBy: { name: 'asc' } });
  }

  async createWasteCategory(dto: AdminCreateWasteCategoryDto) {
    try {
      return await this.prisma.wasteCategory.create({
        data: {
          name: dto.name,
          description: dto.description ?? undefined,
          isActive: dto.isActive ?? true,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new BadRequestException('Category name already exists');
      }
      throw error;
    }
  }

  async updateWasteCategory(id: string, dto: AdminUpdateWasteCategoryDto) {
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    return this.prisma.wasteCategory.update({ where: { id }, data });
  }

  async deleteWasteCategory(id: string) {
    await this.prisma.wasteCategory.delete({ where: { id } }).catch(() => {});
    return { success: true };
  }

  /**
   * Admin updates a booking (assign driver, change status, set final weight/amount).
   * Sends push notifications to the customer (and driver if assigned).
   */
  async updateBooking(id: string, dto: AdminUpdateBookingDto, actor: ActorContext) {
    const existing = await this.prisma.booking.findUnique({
      where: { id },
      include: { wasteCategory: true, driver: true },
    });
    if (!existing) throw new NotFoundException('Booking not found');

    const update: AdminUpdateBookingDto = { ...dto };
    const driverChanged = Boolean(
      update.driverId && update.driverId !== existing.driverId,
    );

    if (driverChanged) {
      if (CLOSED_BOOKING_STATUSES.has(existing.status)) {
        throw new BadRequestException('Cannot assign a driver to a closed booking');
      }

      const driver = await this.prisma.driver.findUnique({
        where: { id: update.driverId },
      });
      if (!driver) throw new BadRequestException('Driver not found');
      if (!driver.approved) {
        throw new BadRequestException('Driver must be approved before assignment');
      }

      if (!update.status && PRE_ASSIGN_BOOKING_STATUSES.has(existing.status)) {
        const canUseAssignedStatus = await this.isBookingStatusSupported(
          BookingStatus.ASSIGNED,
          false,
        );
        if (canUseAssignedStatus) {
          update.status = BookingStatus.ASSIGNED;
        } else {
          this.logger.warn(
            'Skipping auto status ASSIGNED because the database enum is missing that value',
          );
        }
      }
    }

    if (update.status) {
      const isSupported = await this.isBookingStatusSupported(update.status, true);
      if (!isSupported) {
        throw new BadRequestException(
          `Status ${update.status} is not available in the current database schema. Run migrations and restart the backend.`,
        );
      }
    }

    const nextStatus = update.status ?? existing.status;
    const shouldConfirm = nextStatus === BookingStatus.COMPLETED;
    const statusChanged = nextStatus !== existing.status;

    if (statusChanged) {
      const transitionError = getTransitionError(existing.status, nextStatus);
      if (transitionError) {
        throw new BadRequestException(transitionError);
      }
    }

    const hasDriver =
      update.driverId !== undefined ? Boolean(update.driverId) : Boolean(existing.driverId);
    if (
      DRIVER_REQUIRED_BOOKING_STATUSES.has(nextStatus) &&
      !hasDriver
    ) {
      throw new BadRequestException('Assign a driver before advancing this booking');
    }

    const data: any = {};
    if (update.status) data.status = update.status;
    if (update.driverId) data.driverId = update.driverId;
    if (update.actualWeightKg !== undefined) data.actualWeightKg = update.actualWeightKg;
    if (update.finalAmountLkr !== undefined) data.finalAmountLkr = update.finalAmountLkr;
    if (shouldConfirm && !existing.confirmedAt) data.confirmedAt = new Date();

    const weightForAmount =
      update.actualWeightKg !== undefined
        ? update.actualWeightKg
        : existing.actualWeightKg ?? null;
    if (data.finalAmountLkr === undefined && weightForAmount !== null) {
      const computed = await this.calculateFinalAmountLkr(
        existing.wasteCategoryId,
        weightForAmount,
      );
      if (computed !== null) data.finalAmountLkr = computed;
    }

    const updated = await (async () => {
      try {
        return await this.prisma.booking.update({
          where: { id },
          data,
          include: { wasteCategory: true, driver: true },
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (
          update.status &&
          errorMessage.includes('invalid input value for enum') &&
          errorMessage.includes('BookingStatus')
        ) {
          throw new BadRequestException(
            `Status ${update.status} is not available in the current database schema. Run migrations and restart the backend.`,
          );
        }
        throw error;
      }
    })();

    if (statusChanged && actor) {
      await this.recordStatusHistory(existing.id, existing.status, nextStatus, actor);
    }

    // Push notification triggers based on what changed
    const catName = updated.wasteCategory?.name ?? 'waste';
    const shortId = id.slice(0, 8);

    // Driver was just assigned
    if (update.driverId && update.driverId !== existing.driverId) {
      const driver = await this.prisma.driver.findUnique({ where: { id: update.driverId } });
      // Notify customer
      this.pushService
        .notify(existing.userId, {
          title: 'Driver assigned',
          body: `Driver ${driver?.fullName ?? 'a driver'} will collect your ${catName}.`,
          level: NotificationLevel.INFO,
          bookingId: id,
          url: `/users/bookings/${id}`,
        })
        .catch(() => {});
      // Notify driver
      if (driver) {
        this.pushService
          .notify(update.driverId, {
            title: 'New pickup assigned',
            body: `Pickup at ${existing.addressLine1}, ${existing.city} on ${new Date(existing.scheduledDate).toLocaleDateString()} (${existing.scheduledTimeSlot}).`,
            level: NotificationLevel.INFO,
            bookingId: id,
            url: `/driver/bookings`,
          })
          .catch(() => {});
      }
    }

    // Status-based notifications to customer
    if (statusChanged) {
      switch (nextStatus) {
        case 'COLLECTED':
          this.pushService
            .notify(existing.userId, {
              title: 'Pickup collected',
              body: `Your ${catName} pickup #${shortId} has been collected.`,
              level: NotificationLevel.SUCCESS,
              bookingId: id,
              url: `/users/bookings/${id}`,
            })
            .catch(() => {});
          break;
        case 'PAID':
          this.pushService
            .notify(existing.userId, {
              title: 'Payment processed',
              body: `Payment of LKR ${updated.finalAmountLkr?.toFixed(2) ?? '0.00'} for booking #${shortId} was processed.`,
              level: NotificationLevel.SUCCESS,
              bookingId: id,
              url: `/users/bookings/${id}`,
            })
            .catch(() => {});
          break;
        case 'COMPLETED':
          this.pushService
            .notify(existing.userId, {
              title: 'Booking completed',
              body: `Your ${catName} pickup #${shortId} is complete. Final: LKR ${updated.finalAmountLkr?.toFixed(2) ?? '-'}.`,
              level: NotificationLevel.SUCCESS,
              bookingId: id,
              url: `/users/bookings/${id}`,
            })
            .catch(() => {});
          break;
        case 'CANCELLED':
          this.pushService
            .notify(existing.userId, {
              title: 'Booking cancelled',
              body: `Booking #${shortId} was cancelled by the admin.`,
              level: NotificationLevel.WARNING,
              bookingId: id,
              url: `/users/bookings/${id}`,
            })
            .catch(() => {});
          break;
        case 'REFUNDED':
          this.pushService
            .notify(existing.userId, {
              title: 'Refund issued',
              body: `Refund for booking #${shortId} has been processed.`,
              level: NotificationLevel.WARNING,
              bookingId: id,
              url: `/users/bookings/${id}`,
            })
            .catch(() => {});
          break;
      }
    }

    if (shouldConfirm) {
      await this.rewardsService.awardPointsForBooking(updated.id);
    }

    return {
      ...updated,
      user: undefined, // Don't leak full user in admin response
    };
  }

  async assignDriver(id: string, driverId: string, actor: ActorContext) {
    return this.updateBooking(id, { driverId }, actor);
  }

  async updateBookingStatus(
    id: string,
    dto: UpdateBookingStatusDto,
    actor: ActorContext,
  ) {
    return this.updateBooking(
      id,
      {
        status: dto.status,
        actualWeightKg: dto.actualWeightKg,
        finalAmountLkr: dto.finalAmountLkr,
      },
      actor,
    );
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
    actor: ActorContext,
  ) {
    await this.prisma.bookingStatusHistory.create({
      data: {
        bookingId,
        fromStatus,
        toStatus,
        changedById: actor.sub,
        changedByRole: actor.role,
      },
    });
  }

  private async isBookingStatusSupported(
    status: BookingStatus,
    fallbackWhenUnknown: boolean,
  ) {
    await this.loadBookingStatusAvailability();
    if (!this.bookingStatusAvailabilityKnown) return fallbackWhenUnknown;
    return this.bookingStatusAvailability.get(status) === true;
  }

  private async loadBookingStatusAvailability() {
    if (this.bookingStatusAvailabilityLoaded) return;

    this.bookingStatusAvailabilityLoaded = true;
    for (const status of BOOKING_STATUSES) {
      this.bookingStatusAvailability.set(status, false);
    }

    try {
      const rows = await this.prisma.$queryRaw<Array<{ value: string }>>(
        Prisma.sql`
          SELECT e.enumlabel AS "value"
          FROM pg_attribute a
          JOIN pg_class c ON c.oid = a.attrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
          JOIN pg_type t ON t.oid = a.atttypid
          JOIN pg_enum e ON e.enumtypid = t.oid
          WHERE c.relname = 'Booking'
            AND a.attname = 'status'
            AND n.nspname = current_schema()
          ORDER BY e.enumsortorder
        `,
      );

      if (!rows.length) {
        this.logger.warn(
          'Could not load Booking.status enum values from the database. Falling back to default status options.',
        );
        return;
      }

      for (const row of rows) {
        if (this.bookingStatusAvailability.has(row.value as BookingStatus)) {
          this.bookingStatusAvailability.set(row.value as BookingStatus, true);
        }
      }

      this.bookingStatusAvailabilityKnown = true;
    } catch {
      this.logger.warn(
        'Failed to inspect Booking.status enum values from database. Falling back to default status options.',
      );
    }
  }

  /** Debug: trigger a 'Booking completed' style notification for a booking (admin only) */
  async triggerBookingCompletedNotification(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { wasteCategory: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const catName = booking.wasteCategory?.name ?? 'waste';
    const shortId = id.slice(0, 8);

    try {
      await this.pushService.notify(booking.userId, {
        title: 'Booking completed (test) 🎉',
        body: `Your ${catName} pickup #${shortId} is complete (test).`,
        level: NotificationLevel.SUCCESS,
        bookingId: id,
        url: `/users/bookings/${id}`,
      });
    } catch (err) {
      this.logger.error(`Failed to send test completed notification for booking=${id} user=${booking.userId}`, err as Error);
      throw err;
    }

    return { success: true };
  }

  // ─────────────────────────────────────────────
  // Super-Admin: approval & role management
  // ─────────────────────────────────────────────

  /** List admins and drivers whose approved flag is false. */
  async listPendingApprovals() {
    const [admins, drivers] = (await Promise.all([
      this.prisma.admin.findMany({
        where: { approved: false } as any,
        include: { user: { select: { id: true, email: true, role: true, createdAt: true } } },
      }),
      this.prisma.driver.findMany({
        // Cast `where` because TypeScript's generated types may be stale during hot-reload
        where: { approved: false } as any,
        // Use a simple `include: { user: true }` shape so returned driver objects include `user`
        include: { user: true },
      }),
    ])) as any;

    return [
      ...admins.map((a: any) => ({
        id: a.id,
        fullName: a.fullName,
        phone: a.phone,
        email: a.user?.email ?? '',
        role: a.user?.role ?? 'ADMIN',
        createdAt: a.user?.createdAt,
      })),
      ...drivers.map((d: any) => ({
        id: d.id,
        fullName: d.fullName,
        phone: d.phone,
        email: d.user?.email ?? '',
        role: d.user?.role ?? 'DRIVER',
        createdAt: d.user?.createdAt,
      })),
    ];
  }

  /** Approve an admin or driver account. */
  async approveUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { admin: true, driver: true },
    });
    if (!user) throw new NotFoundException('User not found');

    if (user.admin) {
      await this.prisma.admin.update({ where: { id }, data: { approved: true } as any });
    } else if (user.driver) {
      await this.prisma.driver.update({ where: { id }, data: { approved: true } as any });
    } else {
      throw new BadRequestException('User is neither an admin nor a driver');
    }

    return { success: true, message: `User ${id} approved` };
  }

  /** Reject (delete) a pending admin or driver account. */
  async rejectUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { admin: true, driver: true },
    });
    if (!user) throw new NotFoundException('User not found');

    // Clean up profile + user row
    if (user.admin) {
      await this.prisma.admin.delete({ where: { id } });
    }
    if (user.driver) {
      await this.prisma.driver.delete({ where: { id } });
    }
    await this.prisma.user.delete({ where: { id } });

    return { success: true, message: `User ${id} rejected and removed` };
  }

  /** List every user with their role (for the manage-roles page). */
  async listAllUsersWithRoles() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: USER_PROFILE_INCLUDE,
    });
    return users.map((u) => flattenUser(u));
  }

  /** Change a user's role (Super-Admin only). */
  async changeUserRole(id: string, role: string) {
    const validRoles: string[] = Object.values(Role);
    if (!validRoles.includes(role)) {
      throw new BadRequestException(`Invalid role: ${role}`);
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({ where: { id }, data: { role: role as Role } });

    return { success: true, message: `Role changed to ${role}` };
  }

}
