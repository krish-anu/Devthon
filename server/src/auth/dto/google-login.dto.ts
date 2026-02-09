import { IsNotEmpty, IsOptional, IsString, IsBoolean, IsIn } from 'class-validator';

export class GoogleLoginDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsOptional()
  @IsBoolean()
  signup?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['CUSTOMER', 'ADMIN', 'SUPER_ADMIN', 'DRIVER'])
  role?: string;
}
