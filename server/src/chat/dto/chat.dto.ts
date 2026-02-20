import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ChatMessageDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @MaxLength(2000)
  content!: string;
}

export class PageContextDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  metaDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  textContent?: string;
}

export class ChatRequestDto {
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PageContextDto)
  pageContext?: PageContextDto;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  currentRoute?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  roleHint?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  sessionId?: string;

  @IsOptional()
  @IsIn(['AUTO', 'EN', 'SI', 'TA'])
  preferredLanguage?: 'AUTO' | 'EN' | 'SI' | 'TA';
}
