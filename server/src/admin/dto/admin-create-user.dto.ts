import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Role, CustomerType, CustomerStatus } from '@prisma/client';
import { IsEmailDomainDeliverable } from '../../common/validators/email-mx.validator';

export class AdminCreateUserDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsEmail()
  @IsEmailDomainDeliverable({ message: 'Email domain cannot receive mail' })
  email: string;

  @IsString()
  phone: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsEnum(Role)
  role: Role;

  @IsOptional()
  @IsEnum(CustomerType)
  type?: CustomerType;

  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;
}
