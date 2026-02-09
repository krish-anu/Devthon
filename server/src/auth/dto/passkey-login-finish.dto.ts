import { IsEmail, IsNotEmpty } from 'class-validator';
import { IsEmailDomainDeliverable } from '../../common/validators/email-mx.validator';

export class PasskeyLoginFinishDto {
  @IsEmail()
  @IsEmailDomainDeliverable({ message: 'Email domain cannot receive mail' })
  email: string;

  @IsNotEmpty()
  credential: Record<string, any>;
}
