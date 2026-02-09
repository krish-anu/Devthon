import { IsNotEmpty, IsOptional, IsString, IsBoolean, IsIn } from 'class-validator';

export class GoogleCodeDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsOptional()
  redirectUri?: string;

  @IsOptional()
  @IsBoolean()
  signup?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['CUSTOMER', 'ADMIN', 'SUPER_ADMIN', 'DRIVER'])
  role?: string;
}
