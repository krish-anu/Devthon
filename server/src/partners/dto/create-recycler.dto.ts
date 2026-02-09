import { IsEmail, IsNotEmpty, IsString, IsPhoneNumber } from 'class-validator';
import { IsEmailDomainDeliverable } from '../../common/validators/email-mx.validator';

export class CreateRecyclerDto {
  @IsNotEmpty()
  @IsString()
  companyName: string;

  @IsNotEmpty()
  @IsString()
  contactPerson: string;

  @IsNotEmpty()
  @IsPhoneNumber() // Allows any region
  phone: string;

  @IsNotEmpty()
  @IsEmail()
  @IsEmailDomainDeliverable({ message: 'Email domain cannot receive mail' })
  email: string;

  @IsNotEmpty()
  @IsString()
  materialTypes: string;
}
