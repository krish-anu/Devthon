import { IsEnum, IsOptional, IsString, IsNumber } from 'class-validator';
import { BookingStatus } from '@prisma/client';

export class AdminUpdateBookingDto {
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  @IsString()
  driverId?: string;

  @IsOptional()
  @IsNumber()
  actualWeightKg?: number;

  @IsOptional()
  @IsNumber()
  finalAmountLkr?: number;
}
