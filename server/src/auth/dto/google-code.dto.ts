import { IsNotEmpty, IsOptional, IsString, IsIn } from 'class-validator';

export class GoogleCodeDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsOptional()
  redirectUri?: string;

  @IsOptional()
  @IsString()
  @IsIn(['CUSTOMER', 'ADMIN', 'SUPER_ADMIN', 'DRIVER'])
  role?: string;
}
