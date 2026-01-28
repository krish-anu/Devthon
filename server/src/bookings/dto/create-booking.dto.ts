import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBookingDto {
  @IsUUID()
  wasteCategoryId: string;

  @IsString()
  @IsNotEmpty()
  estimatedWeightRange: string;

  @IsNumber()
  @Type(() => Number)
  estimatedMinAmount: number;

  @IsNumber()
  @Type(() => Number)
  estimatedMaxAmount: number;

  @IsString()
  addressLine1: string;

  @IsString()
  city: string;

  @IsString()
  postalCode: string;

  @IsOptional()
  @IsString()
  specialInstructions?: string;

  @IsDateString()
  scheduledDate: string;

  @IsString()
  scheduledTimeSlot: string;
}
