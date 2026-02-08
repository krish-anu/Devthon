import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsPhoneNumber,
  IsOptional,
} from 'class-validator';

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
  email: string;

  @IsOptional()
  @IsString()
  requirements?: string;
}
