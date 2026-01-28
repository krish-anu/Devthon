import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { Role, UserStatus, UserType } from '@prisma/client';

export class AdminCreateUserDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsEmail()
  email: string;

  @IsString()
  phone: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsEnum(Role)
  role: Role;

  @IsEnum(UserType)
  type: UserType;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
