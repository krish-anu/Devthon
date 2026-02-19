import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class CollectDriverBookingDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  weightKg: number;

  @IsOptional()
  @IsUUID()
  wasteCategoryId?: string;
}
