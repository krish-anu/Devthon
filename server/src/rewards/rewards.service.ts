import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  calculatePoints,
  WasteItem,
} from './points-calculator';
import { flattenUser, USER_PROFILE_INCLUDE } from '../common/utils/user.utils';
import { getWasteById, getWasteBySlug } from '../lib/wasteTypeUtils';

const CONFIRMED_STATUSES: BookingStatus[] = [BookingStatus.COMPLETED];

function formatYearMonth(year: number, monthIndex: number) {
  const month = String(monthIndex + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getMonthRange(yearMonth?: string) {
  if (!yearMonth) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return {
      start,
      end,
      yearMonth: formatYearMonth(now.getFullYear(), now.getMonth()),
    };
  }

  const match = /^\d{4}-\d{2}$/.exec(yearMonth);
  if (!match) {
    throw new BadRequestException('Invalid yearMonth. Expected YYYY-MM');
  }

  const [yearPart, monthPart] = yearMonth.split('-');
  const year = Number(yearPart);
  const month = Number(monthPart);

  if (!year || !month || month < 1 || month > 12) {
    throw new BadRequestException('Invalid yearMonth. Expected YYYY-MM');
  }

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  return { start, end, yearMonth: formatYearMonth(year, month - 1) };
}

@Injectable()
export class RewardsService {
  constructor(private prisma: PrismaService) {}

  async getMyRewards(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { start, end, yearMonth } = getMonthRange();

    const [monthAgg, lifetimeAgg, recent] = await Promise.all([
      this.prisma.pointsTransaction.aggregate({
        _sum: { pointsAwarded: true },
        where: {
          userId,
          awardedAt: {
            gte: start,
            lt: end,
          },
        },
      }),
      this.prisma.pointsTransaction.aggregate({
        _sum: { pointsAwarded: true },
        where: { userId },
      }),
      this.prisma.pointsTransaction.findMany({
        where: { userId },
        orderBy: { awardedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          userId: true,
          bookingId: true,
          pointsAwarded: true,
          basePoints: true,
          bonusPoints: true,
          awardedAt: true,
        },
      }),
    ]);

    return {
      totalPoints: lifetimeAgg._sum.pointsAwarded ?? 0,
      monthPoints: monthAgg._sum.pointsAwarded ?? 0,
      monthRange: {
        yearMonth,
        start: start.toISOString(),
        end: end.toISOString(),
      },
      howToEarn: [
        { label: 'Plastic (PET)', value: '10 pts/kg' },
        { label: 'Metal (Aluminum)', value: '20 pts/kg' },
        { label: 'E-waste bonus', value: '+30 per booking' },
        { label: 'Weekly pickup streak', value: '2x multiplier' },
        { label: 'First confirmed booking', value: '1.5x multiplier' },
        { label: 'Multiplier rule', value: 'Highest multiplier only' },
      ],
      recentPointsTransactions: recent,
    };
  }

  async getMonthlyLeaderboard(yearMonth?: string) {
    const { start, end, yearMonth: ym } = getMonthRange(yearMonth);

    const groups = await this.prisma.pointsTransaction.groupBy({
      by: ['userId'],
      _sum: { pointsAwarded: true },
      _min: { awardedAt: true },
      where: {
        awardedAt: {
          gte: start,
          lt: end,
        },
      },
      orderBy: [
        { _sum: { pointsAwarded: 'desc' } },
        { _min: { awardedAt: 'asc' } },
        { userId: 'asc' },
      ],
      take: 10,
    });

    return this.buildLeaderboardResponse(groups, {
      monthRange: {
        yearMonth: ym,
        start: start.toISOString(),
        end: end.toISOString(),
      },
    });
  }

  async getOverallLeaderboard() {
    const groups = await this.prisma.pointsTransaction.groupBy({
      by: ['userId'],
      _sum: { pointsAwarded: true },
      _min: { awardedAt: true },
      orderBy: [
        { _sum: { pointsAwarded: 'desc' } },
        { _min: { awardedAt: 'asc' } },
        { userId: 'asc' },
      ],
      take: 10,
    });

    return this.buildLeaderboardResponse(groups);
  }

  async awardPointsForBooking(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { wasteCategory: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (!CONFIRMED_STATUSES.includes(booking.status)) {
      return { awarded: false, reason: 'not_confirmed' };
    }

    const confirmedAt = booking.confirmedAt ?? new Date();

    const [isFirstBooking, hasWeeklyStreak] = await Promise.all([
      this.isFirstConfirmedBooking(booking.userId, bookingId, confirmedAt),
      this.hasWeeklyPickupStreak(booking.userId, bookingId, confirmedAt),
    ]);

    const items: WasteItem[] = [
      {
        categoryName: booking.wasteCategory?.name ?? 'Unknown',
        categorySlug: (booking.wasteCategory as any)?.slug ?? null,
        weightKg: booking.actualWeightKg ?? 0,
      },
    ];

    const bookingWasteTypes = booking.wasteCategory
      ? [
          {
            id: booking.wasteCategory.id,
            name: booking.wasteCategory.name,
            slug: (booking.wasteCategory as any)?.slug,
          },
        ]
      : [];

    const bookingWaste = getWasteById(bookingWasteTypes, booking.wasteCategoryId);
    const includesEwaste = Boolean(
      getWasteBySlug(bookingWaste ? [bookingWaste] : bookingWasteTypes, 'e-waste'),
    );

    const calculation = calculatePoints({
      items,
      includesEwaste,
      isFirstBooking,
      hasWeeklyStreak,
    });

    return this.prisma.$transaction(async (tx) => {
      let insertedCount = 0;

      try {
        const createResult = await tx.pointsTransaction.createMany({
          data: [
            {
              userId: booking.userId,
              bookingId: booking.id,
              pointsAwarded: calculation.finalPoints,
              basePoints: calculation.basePoints,
              bonusPoints: calculation.bonusPoints,
              multiplier: calculation.multiplier,
              reason: {
                ...calculation.breakdown,
                includesEwaste,
                isFirstBooking,
                hasWeeklyStreak,
              },
              awardedAt: confirmedAt,
            },
          ],
          skipDuplicates: true,
        });
        insertedCount = createResult.count;
      } catch (error) {
        const missingMultiplier = this.isMissingColumnError(
          error,
          'PointsTransaction.multiplier',
        );
        const missingReason = this.isMissingColumnError(
          error,
          'PointsTransaction.reason',
        );

        if (!missingMultiplier && !missingReason) {
          throw error;
        }

        insertedCount = Number(
          await tx.$executeRaw`
            INSERT INTO "PointsTransaction"
              ("userId", "bookingId", "pointsAwarded", "basePoints", "bonusPoints", "awardedAt")
            VALUES
              (${booking.userId}, ${booking.id}, ${calculation.finalPoints}, ${calculation.basePoints}, ${calculation.bonusPoints}, ${confirmedAt})
            ON CONFLICT ("bookingId") DO NOTHING
          `,
        );
      }

      if (insertedCount === 0) {
        return { awarded: false, reason: 'already_awarded' };
      }

      if (!booking.confirmedAt) {
        await tx.booking.update({
          where: { id: booking.id },
          data: { confirmedAt },
        });
      }

      return {
        awarded: true,
        pointsAwarded: calculation.finalPoints,
        breakdown: calculation,
      };
    });
  }

  async backfillMissingPoints(limit = 1000) {
    const normalizedLimit = Math.max(1, Math.floor(limit));
    const bookings = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.COMPLETED,
        pointsTransaction: {
          is: null,
        },
      },
      orderBy: { createdAt: 'asc' },
      take: normalizedLimit,
      select: { id: true },
    });

    let awarded = 0;
    let skipped = 0;
    let failed = 0;

    for (const booking of bookings) {
      try {
        const result = await this.awardPointsForBooking(booking.id);
        if ((result as any)?.awarded) {
          awarded += 1;
        } else {
          skipped += 1;
        }
      } catch {
        failed += 1;
      }
    }

    return {
      scanned: bookings.length,
      awarded,
      skipped,
      failed,
    };
  }

  private async buildLeaderboardResponse(
    groups: Array<{
      userId: string;
      _sum: { pointsAwarded: number | null };
      _min: { awardedAt: Date | null };
    }>,
    extra?: Record<string, unknown>,
  ) {
    if (groups.length === 0) {
      return {
        items: [],
        ...(extra ?? {}),
      };
    }

    const userIds = groups.map((group) => group.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      include: USER_PROFILE_INCLUDE,
    });

    const userMap = new Map(
      users.map((u) => {
        const flat = flattenUser(u);
        return [u.id, flat];
      }),
    );

    const items = groups.map((group, index) => {
      const user = userMap.get(group.userId);
      const name = user?.fullName ?? user?.email ?? 'Anonymous';
      return {
        rank: index + 1,
        userId: group.userId,
        name,
        points: group._sum.pointsAwarded ?? 0,
      };
    });

    return {
      items,
      ...(extra ?? {}),
    };
  }

  private async isFirstConfirmedBooking(
    userId: string,
    bookingId: string,
    confirmedAt: Date,
  ) {
    const count = await this.prisma.booking.count({
      where: {
        userId,
        status: BookingStatus.COMPLETED,
        NOT: { id: bookingId },
        OR: [
          {
            confirmedAt: {
              lt: confirmedAt,
            },
          },
          {
            confirmedAt: null,
            createdAt: {
              lt: confirmedAt,
            },
          },
        ],
      },
    });
    return count === 0;
  }

  private async hasWeeklyPickupStreak(
    userId: string,
    bookingId: string,
    confirmedAt: Date,
  ) {
    const windowStart = new Date(confirmedAt);
    windowStart.setDate(windowStart.getDate() - 7);

    const count = await this.prisma.booking.count({
      where: {
        userId,
        status: BookingStatus.COMPLETED,
        NOT: { id: bookingId },
        OR: [
          {
            confirmedAt: {
              gte: windowStart,
              lt: confirmedAt,
            },
          },
          {
            confirmedAt: null,
            createdAt: {
              gte: windowStart,
              lt: confirmedAt,
            },
          },
        ],
      },
    });

    return count > 0;
  }

  private isMissingColumnError(error: unknown, columnName: string) {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes('does not exist') && message.includes(columnName);
  }
}
