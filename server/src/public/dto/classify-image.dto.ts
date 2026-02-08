import { IsNotEmpty, IsString } from 'class-validator';

export class ClassifyImageDto {
  @IsNotEmpty()
  @IsString()
  imageBase64: string;
}
