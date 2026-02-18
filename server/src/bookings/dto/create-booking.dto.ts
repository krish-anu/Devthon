import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BookingItemDto {
  @IsUUID()
  wasteCategoryId: string;

  @IsNumber()
  @Type(() => Number)
  @Min(0.1)
  quantityKg: number;
}

export class CreateBookingDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BookingItemDto)
  items: BookingItemDto[];

  @IsString()
  addressLine1: string;

  @IsString()
  city: string;

  @IsString()
  postalCode: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  specialInstructions?: string;

  @IsDateString()
  scheduledDate: string;

  @IsString()
  scheduledTimeSlot: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  lng?: number;
}
