import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BookingItemDto {
  @IsUUID()
  wasteCategoryId: string;

  @IsNumber()
  @Type(() => Number)
  quantityKg: number;
}

export class CreateBookingDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookingItemDto)
  items: BookingItemDto[];

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
