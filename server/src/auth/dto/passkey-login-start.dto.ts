import { IsEmail } from 'class-validator';
import { IsEmailDomainDeliverable } from '../../common/validators/email-mx.validator';

export class PasskeyLoginStartDto {
  @IsEmail()
  @IsEmailDomainDeliverable({ message: 'Email domain cannot receive mail' })
  email: string;
}
