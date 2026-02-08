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
import {
  flattenUser,
  USER_PROFILE_INCLUDE,
} from '../common/utils/user.utils';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private supabaseService: SupabaseService,
  ) {}

>>>>>>> 30208fe (Refactor user model and related tables for role-based access control; implement Supabase Auth for user creation and update seeding logic for new structure)
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
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Try to create Supabase Auth user first to get a consistent ID
<<<<<<< HEAD
    const supabaseAuthId = await this.supabaseService.createAuthUser(
      dto.email,
      dto.password,
      {
        fullName: dto.fullName,
        phone: dto.phone,
        type: dto.type,
        role: dto.role ?? 'CUSTOMER',
      },
    );

    // Create User + Customer profile in a single transaction
    const user = await this.prisma.$transaction(async (tx) => {
      const userData: any = {
        email: dto.email,
        passwordHash,
        role: dto.role ?? 'CUSTOMER',
      };

      if (supabaseAuthId) {
        userData.id = supabaseAuthId;
        this.logger.log(
          `Using Supabase Auth ID ${supabaseAuthId} for new user ${dto.email}`,
        );
      }

      const newUser = await tx.user.create({ data: userData });

      // Create the Customer profile (default registration is always a customer)
      await tx.customer.create({
        data: {
          id: newUser.id,
          fullName: dto.fullName,
          phone: dto.phone,
          type: dto.type,
        },
      });

      return tx.user.findUnique({
        where: { id: newUser.id },
        include: USER_PROFILE_INCLUDE,
      });
    });

    // Sync user row to Supabase DB (if configured)
    await this.syncUserToSupabase(createdUser ?? user);

    const tokens = await this.issueTokens(user!);
    return { user: flattenUser(user), ...tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: USER_PROFILE_INCLUDE,
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
<<<<<<< HEAD
    const tokens = await this.issueTokens(user);
    return { user: flattenUser(user), ...tokens };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.getRequiredConfig('JWT_REFRESH_SECRET'),
      });
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: USER_PROFILE_INCLUDE,
      });
      if (!user || !user.refreshTokenHash) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
      if (!matches) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      const tokens = await this.issueTokens(user);
      return { user: flattenUser(user), ...tokens };
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

    if (!googleUser || !googleUser.email) {
      throw new UnauthorizedException('Invalid Google token');
    }

    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { email: googleUser.email },
      include: USER_PROFILE_INCLUDE,
    });

    if (!user) {
      // Try to create Supabase Auth user for Google users too
      const supabaseAuthId = await this.supabaseService.createAuthUser(
        googleUser.email,
        // Generate a random password for Supabase Auth (Google users won't use it)
        Math.random().toString(36).slice(-16) + 'A1!',
        { fullName: googleUser.name || 'Google User', provider: 'google' },
      );

      user = await this.prisma.$transaction(async (tx) => {
        const userData: any = {
          email: googleUser.email,
          role: 'CUSTOMER',
        };

        if (supabaseAuthId) {
          userData.id = supabaseAuthId;
          this.logger.log(
            `Using Supabase Auth ID ${supabaseAuthId} for Google user ${googleUser.email}`,
          );
        }

        const newUser = await tx.user.create({ data: userData });

        await tx.customer.create({
          data: {
            id: newUser.id,
            fullName: googleUser.name || 'Google User',
            phone: '',
            type: 'HOUSEHOLD',
          },
        });

        return tx.user.findUnique({
          where: { id: newUser.id },
          include: USER_PROFILE_INCLUDE,
        });
      });

      // Sync to Supabase DB
      const userWithProfile = await this.prisma.user.findUnique({ where: { id: user.id }, include: { customer: true } });
      await this.syncUserToSupabase(userWithProfile ?? user);
    }

    const tokens = await this.issueTokens(user!);
    return { user: flattenUser(user), ...tokens };
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
  private async syncUserToSupabase(user: any): Promise<void> {
    const flat = flattenUser(user);
    await this.supabaseService.upsertRow('users', {
      id: flat.id,
      email: flat.email,
      role: flat.role,
      fullName: flat.fullName,
      phone: flat.phone,
      address: flat.address,
    });
  }
}
