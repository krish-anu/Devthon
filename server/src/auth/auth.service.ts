import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../common/supabase/supabase.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import type { StringValue } from 'ms';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private supabaseService: SupabaseService,
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

    // Try to create Supabase Auth user first to get a consistent ID
    const supabaseAuthId = await this.supabaseService.createAuthUser(
      dto.email,
      dto.password,
      {
        fullName: dto.fullName,
        phone: dto.phone,
        type: dto.type,
        role: dto.role ?? 'USER',
      },
    );

    const userData: any = {
      fullName: dto.fullName,
      email: dto.email,
      phone: dto.phone,
      passwordHash,
      type: dto.type,
      role: dto.role ?? 'USER',
    };

    // If Supabase Auth returned an ID, use it as the Prisma User ID
    if (supabaseAuthId) {
      userData.id = supabaseAuthId;
      this.logger.log(
        `Using Supabase Auth ID ${supabaseAuthId} for new user ${dto.email}`,
      );
    }

    const user = await this.prisma.user.create({ data: userData });

    // Sync user row to Supabase DB (if configured)
    await this.syncUserToSupabase(user);

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
    // Verify the token with Google (supports access_token or id_token)
    const isJwt = token.split('.').length === 3;
    const tryVerify = async (param: 'access_token' | 'id_token') => {
      const response = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?${param}=${token}`,
      );
      if (!response.ok) {
        return null;
      }
      return response.json();
    };

    const googleUser =
      (isJwt ? await tryVerify('id_token') : await tryVerify('access_token')) ||
      (isJwt ? await tryVerify('access_token') : await tryVerify('id_token'));

    if (!googleUser) {
      throw new UnauthorizedException('Invalid Google token');
    }
    if (!googleUser.email) {
      throw new UnauthorizedException('Invalid Google token');
    }

    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { email: googleUser.email },
    });
    if (!user) {
      // Try to create Supabase Auth user for Google users too
      const supabaseAuthId = await this.supabaseService.createAuthUser(
        googleUser.email,
        // Generate a random password for Supabase Auth (Google users won't use it)
        Math.random().toString(36).slice(-16) + 'A1!',
        { fullName: googleUser.name || 'Google User', provider: 'google' },
      );

      const userData: any = {
        fullName: googleUser.name || 'Google User',
        email: googleUser.email,
        phone: '',
        passwordHash: '', // No password for Google users
        type: 'HOUSEHOLD' as const, // Default type
      };

      if (supabaseAuthId) {
        userData.id = supabaseAuthId;
        this.logger.log(
          `Using Supabase Auth ID ${supabaseAuthId} for Google user ${googleUser.email}`,
        );
      }

      user = await this.prisma.user.create({ data: userData });

      // Sync to Supabase DB
      await this.syncUserToSupabase(user);
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

  /**
   * Sync a user record to Supabase DB (if configured).
   * This keeps the Supabase `users` table in sync with Prisma.
   */
  private async syncUserToSupabase(user: User): Promise<void> {
    await this.supabaseService.upsertRow('users', {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      type: user.type,
      status: user.status,
      address: user.address,
    });
  }
}
