import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PricingItemDto {
  @IsUUID()
  wasteCategoryId: string;

  @IsNumber()
  @Type(() => Number)
  minPriceLkrPerKg: number;

  @IsNumber()
  @Type(() => Number)
  maxPriceLkrPerKg: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AdminUpdatePricingDto {
  @ValidateNested({ each: true })
  @Type(() => PricingItemDto)
  items: PricingItemDto[];
}
