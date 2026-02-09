import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  Matches,
} from 'class-validator';
import { CustomerType } from '@prisma/client';
import { IsEmailDomainDeliverable } from '../../common/validators/email-mx.validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsEmail()
  @IsEmailDomainDeliverable({ message: 'Email domain cannot receive mail' })
  email: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password: string;

  @IsEnum(CustomerType)
  type: CustomerType;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  recaptchaToken?: string;
}
