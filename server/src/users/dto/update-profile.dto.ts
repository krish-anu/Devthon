import { IsEmail, IsOptional, IsString } from 'class-validator';
import { IsEmailDomainDeliverable } from '../../common/validators/email-mx.validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;
}
