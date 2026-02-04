import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import type { StringValue } from 'ms';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  private sanitizeUser(user: User) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, refreshTokenHash, ...safe } = user;
    return safe;
  }

  private async issueTokens(user: User) {
    const payload = { sub: user.id, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.getRequiredConfig('JWT_ACCESS_SECRET'),
      expiresIn: this.getExpires('JWT_ACCESS_EXPIRES', '15m'),
    });
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.getRequiredConfig('JWT_REFRESH_SECRET'),
      expiresIn: this.getExpires('JWT_REFRESH_EXPIRES', '7d'),
    });
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash },
    });
    return { accessToken, refreshToken };
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        type: dto.type,
      },
    });
    const tokens = await this.issueTokens(user);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    // Block login for users without password (e.g., Google-only users)
    if (!user.passwordHash) {
      throw new UnauthorizedException('Please sign in with Google');
    }
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const tokens = await this.issueTokens(user);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.getRequiredConfig('JWT_REFRESH_SECRET'),
      });
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user || !user.refreshTokenHash) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
      if (!matches) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      const tokens = await this.issueTokens(user);
      return { user: this.sanitizeUser(user), ...tokens };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
    return { success: true };
  }

  async googleLogin(token: string) {
    // Verify the token with Google
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${token}`);
    if (!response.ok) {
      throw new UnauthorizedException('Invalid Google token');
    }
    const googleUser = await response.json();
    if (!googleUser.email) {
      throw new UnauthorizedException('Invalid Google token');
    }

    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { email: googleUser.email },
    });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          fullName: googleUser.name || 'Google User',
          email: googleUser.email,
          phone: '',
          passwordHash: '', // No password for Google users
          type: 'HOUSEHOLD', // Default type
        },
      });
    }
    const tokens = await this.issueTokens(user);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  private getRequiredConfig(key: string) {
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new Error(`${key} is not set`);
    }
    return value;
  }

  private getExpires(key: string, fallback: StringValue) {
    const value = this.configService.get<string>(key) ?? fallback;
    return value as StringValue;
  }
}
