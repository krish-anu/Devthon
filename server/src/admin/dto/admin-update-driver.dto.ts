import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { DriverStatus } from '@prisma/client';

export class AdminUpdateDriverDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsNumber()
  rating?: number;

  @IsOptional()
  @IsNumber()
  pickupCount?: number;

  @IsOptional()
  @IsString()
  vehicle?: string;

  @IsOptional()
  @IsEnum(DriverStatus)
  status?: DriverStatus;
}
