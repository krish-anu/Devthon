import { IsNotEmpty, IsOptional, IsString, IsIn } from 'class-validator';

export class GoogleLoginDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsOptional()
  @IsString()
  @IsIn(['CUSTOMER', 'ADMIN', 'SUPER_ADMIN', 'DRIVER'])
  role?: string;
}
