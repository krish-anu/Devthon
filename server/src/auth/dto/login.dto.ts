import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1, { message: 'Password is required' })
  password: string;

  @IsOptional()
  @IsString()
  recaptchaToken?: string;
}
