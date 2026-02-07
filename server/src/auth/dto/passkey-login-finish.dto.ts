import { IsEmail, IsNotEmpty } from 'class-validator';

export class PasskeyLoginFinishDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  credential: Record<string, any>;
}
