import { IsArray, IsNotEmpty, IsString, ArrayMinSize } from 'class-validator';

export class AdminSendSmsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  phoneNumbers: string[];

  @IsString()
  @IsNotEmpty()
  message: string;
}
