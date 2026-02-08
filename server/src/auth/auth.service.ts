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
import { flattenUser, USER_PROFILE_INCLUDE } from '../common/utils/user.utils';
import { createRemoteJWKSet, jwtVerify } from 'jose';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private supabaseService: SupabaseService,
  ) {}

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
    await this.syncUserToSupabase(user);

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

  // Helper: fetch https://openidconnect.googleapis.com/v1/userinfo
  private async fetchUserInfo(accessToken: string) {
    const r = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) return null;
    return r.json();
  }

  // Helper: verify ID token using Google's JWKS
  private jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

  private async verifyIdToken(idToken: string) {
    const clientId = this.getRequiredConfig('GOOGLE_CLIENT_ID');
    try {
      const { payload } = await jwtVerify(idToken, this.jwks, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: clientId,
      });
      return payload as any;
    } catch (err) {
      this.logger.warn('ID token verification failed', err as any);
      throw new UnauthorizedException('Invalid Google ID token');
    }
  }

  // Public: accept access_token or id_token and authenticate/create user
  async googleLogin(token: string) {
    let googleUser: any = null;
    const isJwt = token.split('.').length === 3;

    if (isJwt) {
      // Prefer strict JWT verification
      try {
        googleUser = await this.verifyIdToken(token);
      } catch (err) {
        // Fallback to tokeninfo if verification fails
        const ti = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
        if (ti.ok) googleUser = await ti.json();
      }
    } else {
      // Treat as access token and call UserInfo
      googleUser = await this.fetchUserInfo(token);
      if (!googleUser) {
        const ti = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${token}`);
        if (ti.ok) googleUser = await ti.json();
      }
    }

    if (!googleUser || !googleUser.email) {
      throw new UnauthorizedException('Invalid Google token');
    }

    if (!googleUser.email_verified) {
      throw new UnauthorizedException('Google email not verified');
    }

    return this.findOrCreateUserFromGoogle(googleUser);
  }

  // Exchange authorization code server-side and authenticate
  async googleLoginWithCode(code: string, redirectUri?: string) {
    const client_id = this.getRequiredConfig('GOOGLE_CLIENT_ID');
    const client_secret = this.getRequiredConfig('GOOGLE_CLIENT_SECRET');
    const redirect_uri = redirectUri ?? this.getRequiredConfig('GOOGLE_REDIRECT_URI');

    const params = new URLSearchParams({
      code,
      client_id,
      client_secret,
      redirect_uri,
      grant_type: 'authorization_code',
    });

    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!r.ok) {
      const txt = await r.text();
      this.logger.warn('Failed to exchange code with Google', txt);
      throw new UnauthorizedException('Invalid authorization code');
    }

    const tokens = await r.json();
    let googleUser: any = null;

    if (tokens.access_token) {
      googleUser = await this.fetchUserInfo(tokens.access_token);
    }

    if (!googleUser && tokens.id_token) {
      googleUser = await this.verifyIdToken(tokens.id_token);
    }

    if (!googleUser || !googleUser.email) {
      throw new UnauthorizedException('Failed to obtain Google user');
    }

    if (!googleUser.email_verified) {
      throw new UnauthorizedException('Google email not verified');
    }

    return this.findOrCreateUserFromGoogle(googleUser);
  }

  // Shared logic to find or create app user from Google profile
  private async findOrCreateUserFromGoogle(googleUser: any) {
    let user = await this.prisma.user.findUnique({
      where: { email: googleUser.email },
      include: USER_PROFILE_INCLUDE,
    });

    if (!user) {
      // Try to create Supabase Auth user for Google users too
      const supabaseAuthId = await this.supabaseService.createAuthUser(
        googleUser.email,
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
      const userWithProfile = await this.prisma.user.findUnique({
        where: { id: user!.id },
        include: { customer: true },
      });
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
