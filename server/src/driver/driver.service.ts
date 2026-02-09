import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { flattenUser, USER_PROFILE_INCLUDE } from '../common/utils/user.utils';

@Injectable()
export class DriverService {
  constructor(private prisma: PrismaService) {}

  async getBookings(driverId: string) {
    const bookings = await this.prisma.booking.findMany({
      where: { driverId },
      include: {
        user: {
          include: USER_PROFILE_INCLUDE,
        },
        wasteCategory: true,
      },
      orderBy: { scheduledDate: 'asc' },
    });

    return bookings.map((b) => ({
      ...b,
      user: flattenUser(b.user),
    }));
  }
}
