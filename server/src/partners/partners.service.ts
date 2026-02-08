import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecyclerDto } from './dto/create-recycler.dto';
import { CreateCorporateDto } from './dto/create-corporate.dto';
import { Role } from '@prisma/client';

@Injectable()
export class PartnersService {
  constructor(private prisma: PrismaService) {}

  async createRecycler(dto: CreateRecyclerDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists.');
    }

    // Transaction to ensure both User and Recycler profile are created
    const result = await this.prisma.$transaction(async (prisma) => {
      const user = await prisma.user.create({
        data: {
          email: dto.email,
          role: Role.RECYCLER,
          // No password hash - user must set password via email/forgot password
        },
      });

      const recycler = await prisma.recycler.create({
        data: {
          id: user.id,
          companyName: dto.companyName,
          contactPerson: dto.contactPerson,
          phone: dto.phone,
          materialTypes: dto.materialTypes,
        },
      });

      return { user, recycler };
    });

    return result;
  }

  async createCorporate(dto: CreateCorporateDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists.');
    }

    const result = await this.prisma.$transaction(async (prisma) => {
      const user = await prisma.user.create({
        data: {
          email: dto.email,
          role: Role.CORPORATE,
        },
      });

      const corporate = await prisma.corporate.create({
        data: {
          id: user.id,
          organizationName: dto.organizationName,
          contactName: dto.contactName,
          phone: dto.phone,
          requirements: dto.requirements,
        },
      });

      return { user, corporate };
    });

    return result;
  }
}
