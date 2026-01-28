import { IsEmail } from 'class-validator';

export class OtpSendDto {
  @IsEmail()
  email: string;
}
