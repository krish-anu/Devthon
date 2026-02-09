import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, CustomerType, NotificationLevel, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../notifications/push.service';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { AdminCreateDriverDto } from './dto/admin-create-driver.dto';
import { AdminUpdateDriverDto } from './dto/admin-update-driver.dto';
import { AdminUpdatePricingDto } from './dto/admin-update-pricing.dto';
import { AdminUpdateBookingDto } from './dto/admin-update-booking.dto';
import { AdminBookingsQueryDto } from './dto/admin-bookings-query.dto';
import * as bcrypt from 'bcrypt';
import { flattenUser, USER_PROFILE_INCLUDE } from '../common/utils/user.utils';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private pushService: PushService,
  ) {}

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
        totalRevenue: revenueAgg._sum.amountLkr ?? 0,
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

  /**
   * Admin updates a booking (assign driver, change status, set final weight/amount).
   * Sends push notifications to the customer (and driver if assigned).
   */
  async updateBooking(id: string, dto: AdminUpdateBookingDto) {
    const existing = await this.prisma.booking.findUnique({
      where: { id },
      include: { wasteCategory: true, driver: true },
    });
    if (!existing) throw new NotFoundException('Booking not found');

    const data: any = {};
    if (dto.status) data.status = dto.status;
    if (dto.driverId) data.driverId = dto.driverId;
    if (dto.actualWeightKg !== undefined) data.actualWeightKg = dto.actualWeightKg;
    if (dto.finalAmountLkr !== undefined) data.finalAmountLkr = dto.finalAmountLkr;

    const updated = await this.prisma.booking.update({
      where: { id },
      data,
      include: { wasteCategory: true, driver: true },
    });

    // ── Push notification triggers based on what changed ──
    const catName = updated.wasteCategory?.name ?? 'waste';
    const shortId = id.slice(0, 8);

    // Driver was just assigned
    if (dto.driverId && dto.driverId !== existing.driverId) {
      const driver = await this.prisma.driver.findUnique({ where: { id: dto.driverId } });
      // Notify customer
      this.pushService
        .notify(existing.userId, {
          title: 'Driver assigned 🚚',
          body: `Driver ${driver?.fullName ?? 'a driver'} will collect your ${catName}.`,
          level: NotificationLevel.INFO,
          bookingId: id,
          url: `/users/bookings/${id}`,
        })
        .catch(() => {});
      // Notify driver
      if (driver) {
        this.pushService
          .notify(dto.driverId, {
            title: 'New pickup assigned 📦',
            body: `Pickup at ${existing.addressLine1}, ${existing.city} on ${new Date(existing.scheduledDate).toLocaleDateString()} (${existing.scheduledTimeSlot}).`,
            level: NotificationLevel.INFO,
            bookingId: id,
            url: `/driver/bookings`,
          })
          .catch(() => {});
      }
    }

    // Status-based notifications to customer
    if (dto.status && dto.status !== existing.status) {
      switch (dto.status) {
        case 'COLLECTED':
          this.pushService
            .notify(existing.userId, {
              title: 'Pickup collected ✅',
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
              title: 'Payment processed 💰',
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
              title: 'Booking completed 🎉',
              body: `Your ${catName} pickup #${shortId} is complete. Final: LKR ${updated.finalAmountLkr?.toFixed(2) ?? '—'}.`,
              level: NotificationLevel.SUCCESS,
              bookingId: id,
              url: `/users/bookings/${id}`,
            })
            .catch(() => {});
          break;
        case 'CANCELLED':
          this.pushService
            .notify(existing.userId, {
              title: 'Booking cancelled ❌',
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
              title: 'Refund issued 💸',
              body: `Refund for booking #${shortId} has been processed.`,
              level: NotificationLevel.WARNING,
              bookingId: id,
              url: `/users/bookings/${id}`,
            })
            .catch(() => {});
          break;
      }
    }

    return {
      ...updated,
      user: undefined, // Don't leak full user in admin response
    };
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
