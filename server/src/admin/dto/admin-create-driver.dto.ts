import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { DriverStatus } from '@prisma/client';

export class AdminCreateDriverDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsNumber()
  rating?: number;

  @IsOptional()
  @IsNumber()
  pickupCount?: number;

  @IsString()
  vehicleType: string;

  @IsOptional()
  @IsEnum(DriverStatus)
  status?: DriverStatus;
}
