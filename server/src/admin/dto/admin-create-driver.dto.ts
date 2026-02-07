import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { DriverStatus } from '@prisma/client';

export class AdminCreateDriverDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  phone: string;

  @IsString()
  @IsNotEmpty()
  email: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsNumber()
  rating?: number;

  @IsOptional()
  @IsNumber()
  pickupCount?: number;

  @IsString()
  vehicle: string;

  @IsOptional()
  @IsEnum(DriverStatus)
  status?: DriverStatus;
}
