<<<<<<< HEAD
import { IsNotEmpty, IsOptional, IsString, IsIn } from 'class-validator';
=======
import { IsNotEmpty, IsOptional, IsString, IsBoolean } from 'class-validator';
>>>>>>> 97d3f2d (feat: integrate reCAPTCHA verification for user registration and login, enhance Google login DTOs)

export class GoogleLoginDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsOptional()
<<<<<<< HEAD
  @IsString()
  @IsIn(['CUSTOMER', 'ADMIN', 'SUPER_ADMIN', 'DRIVER'])
  role?: string;
=======
  @IsBoolean()
  signup?: boolean;
>>>>>>> 97d3f2d (feat: integrate reCAPTCHA verification for user registration and login, enhance Google login DTOs)
}
