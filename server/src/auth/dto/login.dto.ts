import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { IsEmailDomainDeliverable } from '../../common/validators/email-mx.validator';

export class LoginDto {
  @IsEmail()
  @IsEmailDomainDeliverable({ message: 'Email domain cannot receive mail' })
  email: string;

  @IsString()
  @MinLength(1, { message: 'Password is required' })
  password: string;

  @IsOptional()
  @IsString()
  recaptchaToken?: string;
}
