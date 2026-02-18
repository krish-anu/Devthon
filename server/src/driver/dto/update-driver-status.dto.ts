import { DriverStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateDriverStatusDto {
  @IsEnum(DriverStatus)
  status: DriverStatus;
}
