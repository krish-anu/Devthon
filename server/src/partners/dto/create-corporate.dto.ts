import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsPhoneNumber,
  IsOptional,
} from 'class-validator';
import { IsEmailDomainDeliverable } from '../../common/validators/email-mx.validator';

export class CreateCorporateDto {
  @IsNotEmpty()
  @IsString()
  organizationName: string;

  @IsNotEmpty()
  @IsString()
  contactName: string;

  @IsNotEmpty()
  @IsPhoneNumber()
  phone: string;

  @IsNotEmpty()
  @IsEmail()
  @IsEmailDomainDeliverable({ message: 'Email domain cannot receive mail' })
  email: string;

  @IsOptional()
  @IsString()
  requirements?: string;
}
