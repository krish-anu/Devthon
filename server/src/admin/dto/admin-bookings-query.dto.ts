import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { BookingStatus } from '@prisma/client';

export class AdminBookingsQueryDto {
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
