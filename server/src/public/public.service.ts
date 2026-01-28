import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PublicService {
  constructor(private prisma: PrismaService) {}

  async getPricing() {
    return this.prisma.pricing.findMany({
      where: { isActive: true },
      include: { wasteCategory: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async launchNotify(email: string) {
    try {
      return await this.prisma.launchNotify.create({ data: { email } });
    } catch (error) {
      throw new ConflictException('Email already registered');
    }
  }
}
