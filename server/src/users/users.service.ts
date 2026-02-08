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
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: USER_PROFILE_INCLUDE,
    });
    if (!user) throw new NotFoundException('User not found');
    return flattenUser(user);
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    // Fetch the user to determine their role
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
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
      switch (user.role) {
        case 'CUSTOMER':
          await this.prisma.customer.upsert({
            where: { id: userId },
            update: profileData,
            create: { id: userId, fullName: dto.fullName ?? '', phone: dto.phone ?? '', ...profileData },
          });
          break;
        case 'ADMIN':
        case 'SUPER_ADMIN':
          await this.prisma.admin.upsert({
            where: { id: userId },
            update: profileData,
            create: { id: userId, fullName: dto.fullName ?? '', phone: dto.phone ?? '', ...profileData },
          });
          break;
        case 'DRIVER':
          await this.prisma.driver.upsert({
            where: { id: userId },
            update: profileData,
            create: { id: userId, fullName: dto.fullName ?? '', phone: dto.phone ?? '', vehicle: '', ...profileData },
          });
          break;
      }
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
      throw new BadRequestException('No password set for this account (Google sign-in only)');
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
