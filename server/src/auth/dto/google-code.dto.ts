import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GoogleCodeDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsOptional()
  redirectUri?: string;
}
