import { IsEmail, IsNotEmpty, IsString, IsPhoneNumber } from 'class-validator';

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
  email: string;

  @IsNotEmpty()
  @IsString()
  materialTypes: string;
}
