import { IsNotEmpty, IsString } from 'class-validator';

export class AdminAssignDriverDto {
  @IsString()
  @IsNotEmpty()
  driverId: string;
}
