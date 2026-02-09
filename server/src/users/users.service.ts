import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import * as bcrypt from 'bcrypt';
import { ChangePasswordDto } from './dto/change-password.dto';
import {
  flattenUser,
  USER_PROFILE_INCLUDE,
} from '../common/utils/user.utils';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

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

    if (Object.keys(profileData).length > 0) {
      // Helper to clean up conflicting profiles if they exist (handling inconsistent DB states)
      const cleanConflictingProfiles = async (tx: any, role: string) => {
        if (role !== 'CUSTOMER' && (user as any).customer) {
          await tx.customer.delete({ where: { id: userId } });
        }
        if (!['ADMIN', 'SUPER_ADMIN'].includes(role) && (user as any).admin) {
          await tx.admin.delete({ where: { id: userId } });
        }
        if (role !== 'DRIVER' && (user as any).driver) {
          await tx.driver.delete({ where: { id: userId } });
        }
        if (role !== 'RECYCLER' && (user as any).recycler) {
          await tx.recycler.delete({ where: { id: userId } });
        }
        if (role !== 'CORPORATE' && (user as any).corporate) {
          await tx.corporate.delete({ where: { id: userId } });
        }
      };

      // Helper to get fallback data from any existing profile to prevent data loss
      const getFallbackData = () => {
        const p = (user as any).customer || (user as any).admin || (user as any).driver || (user as any).recycler || (user as any).corporate || {};
        return {
          fullName: p.fullName ?? p.contactPerson ?? p.organizationName ?? dto.fullName ?? '',
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
            await tx.customer.upsert({
              where: { id: userId },
              update: profileData,
              create: {
                id: userId,
                fullName: fallbackCust.fullName,
                phone: fallbackCust.phone,
                type: 'HOUSEHOLD',
                ...profileData
              },
            });
            break;

          case 'ADMIN':
          case 'SUPER_ADMIN':
            await cleanConflictingProfiles(tx, user.role);
            const fallbackAdmin = getFallbackData();
            await tx.admin.upsert({
              where: { id: userId },
              update: profileData,
              create: {
                id: userId,
                fullName: fallbackAdmin.fullName,
                phone: fallbackAdmin.phone,
                ...profileData
              },
            });
            break;

          case 'DRIVER':
            await cleanConflictingProfiles(tx, user.role);
            const fallbackDriver = getFallbackData();
            await tx.driver.upsert({
              where: { id: userId },
              update: profileData,
              create: {
                id: userId,
                fullName: fallbackDriver.fullName,
                phone: fallbackDriver.phone,
                vehicle: 'Not specified',
                ...profileData
              },
            });
            break;
        }
      });
    }

    // Re-fetch and return flattened user
    const updated = await this.prisma.user.findUnique({
      where: { id: userId },
      include: USER_PROFILE_INCLUDE,
    });
    return flattenUser(updated);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (!dto?.currentPassword || !dto?.newPassword) {
      throw new BadRequestException('Missing password fields');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (!user.passwordHash) {
      throw new BadRequestException('No local password is set for this account');
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
}
