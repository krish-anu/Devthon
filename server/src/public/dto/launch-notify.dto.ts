import { IsEmail } from 'class-validator';

export class LaunchNotifyDto {
  @IsEmail()
  email: string;
}
