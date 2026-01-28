import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { DriverStatus } from '@prisma/client';

export class AdminUpdateDriverDto {
  @IsOptional()
  @IsString()
  name?: string;

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
  vehicleType?: string;

  @IsOptional()
  @IsEnum(DriverStatus)
  status?: DriverStatus;
}
