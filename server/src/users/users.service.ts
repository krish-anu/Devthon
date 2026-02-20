import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import * as bcrypt from 'bcrypt';
import { ChangePasswordDto } from './dto/change-password.dto';
import { flattenUser, USER_PROFILE_INCLUDE } from '../common/utils/user.utils';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getMe(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: USER_PROFILE_INCLUDE,
      });
      if (!user) throw new NotFoundException('User not found');
      return flattenUser(user);
    } catch (error) {
      console.error('Error in getMe:', error);
      throw error;
    }
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    // Fetch the user to determine their role
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: USER_PROFILE_INCLUDE,
    });
    if (!user) throw new NotFoundException('User not found');

    // Update email on User table if provided
    if (dto.email) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { email: dto.email },
      });
    }

    // Update profile data on the role-specific table
    const profileData: any = {};
    if (dto.fullName !== undefined) profileData.fullName = dto.fullName;
    if (dto.phone !== undefined) profileData.phone = dto.phone;
    if (dto.address !== undefined) profileData.address = dto.address;
    if (dto.avatarUrl !== undefined) profileData.avatarUrl = dto.avatarUrl;

    if (Object.keys(profileData).length > 0) {
      // Helper to clean up conflicting profiles if they exist (handling inconsistent DB states)
      // Use deleteMany to avoid relying on potentially stale relation data.
      const cleanConflictingProfiles = async (tx: any, role: string) => {
        if (role !== 'CUSTOMER') {
          await tx.customer.deleteMany({ where: { id: userId } });
        }
        if (!['ADMIN', 'SUPER_ADMIN'].includes(role)) {
          await tx.admin.deleteMany({ where: { id: userId } });
        }
        if (role !== 'DRIVER') {
          await tx.driver.deleteMany({ where: { id: userId } });
        }
        if (role !== 'RECYCLER') {
          await tx.recycler.deleteMany({ where: { id: userId } });
        }
        if (role !== 'CORPORATE') {
          await tx.corporate.deleteMany({ where: { id: userId } });
        }
      };

      // Helper to get fallback data from any existing profile to prevent data loss
      const getFallbackData = () => {
        const p =
          (user as any).customer ||
          (user as any).admin ||
          (user as any).driver ||
          (user as any).recycler ||
          (user as any).corporate ||
          {};
        return {
          fullName:
            p.fullName ??
            p.contactPerson ??
            p.organizationName ??
            dto.fullName ??
            '',
          phone: p.phone ?? dto.phone ?? '',
          address: p.address ?? dto.address,
          avatarUrl: p.avatarUrl,
        };
      };

      await this.prisma.$transaction(async (tx) => {
        switch (user.role) {
          case 'CUSTOMER':
            await cleanConflictingProfiles(tx, user.role);
            const fallbackCust = getFallbackData();
            const existingCustomer = await tx.customer.findUnique({
              where: { id: userId },
              select: { id: true },
            });
            if (existingCustomer) {
              await tx.customer.update({
                where: { id: userId },
                data: profileData,
              });
            } else {
              await tx.customer.create({
                data: {
                  id: userId,
                  fullName: fallbackCust.fullName,
                  phone: fallbackCust.phone,
                  type: 'HOUSEHOLD',
                  ...profileData,
                },
              });
            }
            break;

          case 'ADMIN':
          case 'SUPER_ADMIN':
            await cleanConflictingProfiles(tx, user.role);
            const fallbackAdmin = getFallbackData();
            const existingAdmin = await tx.admin.findUnique({
              where: { id: userId },
              select: { id: true },
            });
            if (existingAdmin) {
              await tx.admin.update({
                where: { id: userId },
                data: profileData,
              });
            } else {
              await tx.admin.create({
                data: {
                  id: userId,
                  fullName: fallbackAdmin.fullName,
                  phone: fallbackAdmin.phone,
                  ...profileData,
                },
              });
            }
            break;

          case 'DRIVER':
            await cleanConflictingProfiles(tx, user.role);
            const fallbackDriver = getFallbackData();
            const existingDriver = await tx.driver.findUnique({
              where: { id: userId },
              select: { id: true },
            });
            if (existingDriver) {
              await tx.driver.update({
                where: { id: userId },
                data: profileData,
              });
            } else {
              await tx.driver.create({
                data: {
                  id: userId,
                  fullName: fallbackDriver.fullName,
                  phone: fallbackDriver.phone,
                  vehicle: 'Not specified',
                  ...profileData,
                },
              });
            }
            break;
        }
      });
    }

    // Re-fetch and return flattened user
    const updated = await this.prisma.user.findUnique({
      where: { id: userId },
      include: USER_PROFILE_INCLUDE,
    });

    // Clear server cache so /me returns the fresh profile immediately
    await ((this.cacheManager as any).clear?.() ?? (this.cacheManager as any).reset?.());

    return flattenUser(updated);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (!dto?.currentPassword || !dto?.newPassword) {
      throw new BadRequestException('Missing password fields');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (!user.passwordHash) {
      throw new BadRequestException(
        'No local password is set for this account',
      );
    }

    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Current password is incorrect');

    const newHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    return { success: true };
  }

  async deleteMe(userId: string, dto: any) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // If the user has a local password, require confirmation
    if (user.passwordHash) {
      if (!dto?.currentPassword) {
        throw new BadRequestException(
          'Current password is required to delete this account',
        );
      }
      const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
      if (!ok) throw new UnauthorizedException('Current password is incorrect');
    }

    // Snapshot the current user/profile for server logs (avoids adding schema changes in this patch)
    try {
      console.info(`Deleting/anonymizing user ${userId}`, {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
        },
      });

      // Anonymize PII but keep domain data (bookings/payments) for accounting.
      await this.prisma.$transaction(async (tx) => {
        // Update user: anonymize email, clear hashes and refresh tokens, downgrade role to CUSTOMER for safety
        await tx.user.update({
          where: { id: userId },
          data: {
            email: `deleted+${userId}@deleted.trash2treasure`,
            passwordHash: null,
            refreshTokenHash: null,
            role: 'CUSTOMER',
          },
        });

        // Clear / anonymize role-specific profile tables
        await tx.customer.updateMany({
          where: { id: userId },
          data: {
            fullName: 'Deleted user',
            phone: '',
            address: null,
            avatarUrl: null,
            status: 'INACTIVE',
          },
        });
        await tx.admin.updateMany({
          where: { id: userId },
          data: {
            fullName: 'Deleted user',
            phone: '',
            address: null,
            avatarUrl: null,
            approved: false,
          },
        });
        await tx.driver.updateMany({
          where: { id: userId },
          data: {
            fullName: 'Deleted user',
            phone: '',
            avatarUrl: null,
            status: 'OFFLINE',
            approved: false,
          },
        });
        await tx.recycler.updateMany({
          where: { id: userId },
          data: { companyName: 'Deleted user', contactPerson: '', phone: '' },
        });
        await tx.corporate.updateMany({
          where: { id: userId },
          data: {
            organizationName: 'Deleted user',
            contactName: '',
            phone: '',
          },
        });

        // Remove sensitive related records
        await tx.passkeyCredential.deleteMany({ where: { userId } });
        await tx.pushSubscription.deleteMany({ where: { userId } });
        await tx.userPermission.deleteMany({ where: { userId } });

        // Disassociate notifications from this user (keep messages for analytics/audit)
        await tx.notification.updateMany({
          where: { userId },
          data: { userId: null },
        });
      });

      return { success: true };
    } catch (err) {
      console.error('Error while deleting user', userId, err);
      throw err;
    }
  }
}
