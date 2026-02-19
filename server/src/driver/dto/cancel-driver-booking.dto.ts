import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelDriverBookingDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}
