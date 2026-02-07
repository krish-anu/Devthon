import { IsEmail } from 'class-validator';

export class PasskeyLoginStartDto {
  @IsEmail()
  email: string;
}
