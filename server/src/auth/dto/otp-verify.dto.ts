import { IsString, Length } from 'class-validator';

export class OtpVerifyDto {
  @IsString()
  @Length(6, 6)
  code: string;
}
