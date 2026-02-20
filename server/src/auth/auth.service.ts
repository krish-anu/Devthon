import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../common/supabase/supabase.service';
import { RecaptchaService } from '../common/recaptcha.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import type { StringValue } from 'ms';
import { flattenUser, USER_PROFILE_INCLUDE } from '../common/utils/user.utils';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly retryableGoogleNetworkErrorCodes = new Set([
    'EAI_AGAIN',
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'UND_ERR_CONNECT_TIMEOUT',
    'UND_ERR_HEADERS_TIMEOUT',
  ]);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private supabaseService: SupabaseService,
    private recaptchaService: RecaptchaService,
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

  private getRecaptchaAction(kind: 'signup' | 'login') {
    if (kind === 'signup')
      return (
        this.configService.get<string>('RECAPTCHA_SIGNUP_ACTION') ??
        this.configService.get<string>('RECAPTCHA_ADMIN_SIGNUP_ACTION') ??
        'signup'
      );
    return (
      this.configService.get<string>('RECAPTCHA_LOGIN_ACTION') ??
      this.configService.get<string>('RECAPTCHA_ADMIN_LOGIN_ACTION') ??
      'login'
    );
  }

  async register(dto: RegisterDto) {
    // Verify reCAPTCHA for all registrations
    const action = this.getRecaptchaAction('signup');
    const ok = await this.recaptchaService.verify(dto.recaptchaToken, action);
    if (!ok) {
      throw new UnauthorizedException('reCAPTCHA verification failed');
    }

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

      // Create profile based on role
      if (dto.role === 'ADMIN') {
        await tx.admin.create({
          data: {
            id: newUser.id,
            fullName: dto.fullName,
            phone: dto.phone,
          },
        });
      } else if (dto.role === 'DRIVER') {
        await tx.driver.create({
          data: {
            id: newUser.id,
            fullName: dto.fullName,
            phone: dto.phone,
            vehicle: 'Not specified',
          },
        });
      } else {
        // Default to CUSTOMER
        await tx.customer.create({
          data: {
            id: newUser.id,
            fullName: dto.fullName,
            phone: dto.phone,
            type: dto.type,
          },
        });
      }

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
    // Verify reCAPTCHA for all logins
    const action = this.getRecaptchaAction('login');
    const ok = await this.recaptchaService.verify(dto.recaptchaToken, action);
    if (!ok) {
      throw new UnauthorizedException('reCAPTCHA verification failed');
    }

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

    // Block unapproved admins and drivers
    if (user.role === 'ADMIN' && user.admin && !user.admin.approved) {
      throw new UnauthorizedException(
        'Your account is pending approval by a Super Admin.',
      );
    }
    if (user.role === 'DRIVER' && user.driver && !user.driver.approved) {
      throw new UnauthorizedException(
        'Your account is pending approval by a Super Admin.',
      );
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

  // Helper: verify ID token using Google's JWKS (lazy-load ESM-only 'jose')
  private jwks: any | null = null;

  private async verifyIdToken(idToken: string) {
    const clientId = this.getRequiredConfig('GOOGLE_CLIENT_ID');
    try {
      const jose = await import('jose');
      if (!this.jwks) {
        this.jwks = jose.createRemoteJWKSet(
          new URL('https://www.googleapis.com/oauth2/v3/certs'),
        );
      }
      const { payload } = await jose.jwtVerify(idToken, this.jwks, {
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
  async googleLogin(token: string, isSignup = false, role?: string) {
    let googleUser: any = null;
    const isJwt = token.split('.').length === 3;

    if (isJwt) {
      // Prefer strict JWT verification
      try {
        googleUser = await this.verifyIdToken(token);
      } catch (err) {
        // Fallback to tokeninfo if verification fails
        const ti = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${token}`,
        );
        if (ti.ok) googleUser = await ti.json();
      }
    } else {
      // Treat as access token and call UserInfo
      googleUser = await this.fetchUserInfo(token);
      if (!googleUser) {
        const ti = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?access_token=${token}`,
        );
        if (ti.ok) googleUser = await ti.json();
      }
    }

    if (!googleUser || !googleUser.email) {
      throw new UnauthorizedException('Invalid Google token');
    }

    if (!googleUser.email_verified) {
      throw new UnauthorizedException('Google email not verified');
    }

    return this.findOrCreateUserFromGoogle(googleUser, isSignup, role);
  }

  // Exchange authorization code server-side and authenticate
  async googleLoginWithCode(
    code: string,
    redirectUri?: string,
    isSignup = false,
    role?: string,
  ) {
    const client_id = this.getRequiredConfig('GOOGLE_CLIENT_ID');
    const client_secret = this.getRequiredConfig('GOOGLE_CLIENT_SECRET');
    const redirect_uri =
      redirectUri ?? this.getRequiredConfig('GOOGLE_REDIRECT_URI');

    const params = new URLSearchParams({
      code,
      client_id,
      client_secret,
      redirect_uri,
      grant_type: 'authorization_code',
    });

    let r: Response | null = null;
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        r = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        });
        break;
      } catch (error: any) {
        const code =
          error?.cause?.code ?? error?.code ?? error?.cause?.name ?? 'UNKNOWN';
        const retryable = this.retryableGoogleNetworkErrorCodes.has(code);
        const details = {
          code,
          message: error?.message ?? String(error),
          cause: error?.cause?.message ?? null,
          attempt,
          maxAttempts,
          retryable,
        };

        if (retryable && attempt < maxAttempts) {
          this.logger.warn('Google OAuth token exchange network retry', details);
          await this.sleep(250 * attempt);
          continue;
        }

        this.logger.error('Google OAuth token exchange failed', details);
        throw new BadRequestException(
          'Google OAuth exchange failed. Check GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI and network access.',
        );
      }
    }

    if (!r) {
      throw new BadRequestException(
        'Google OAuth exchange failed. Check GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI and network access.',
      );
    }

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

    return this.findOrCreateUserFromGoogle(googleUser, isSignup, role);
  }

  /**
   * Extract the display name from a Google profile object.
   * Google may return `name`, `given_name`, `family_name`, or none.
   */
  private extractGoogleName(googleUser: any): string {
    if (googleUser.name && typeof googleUser.name === 'string' && googleUser.name.trim()) {
      return googleUser.name.trim();
    }
    const parts: string[] = [];
    if (googleUser.given_name) parts.push(googleUser.given_name);
    if (googleUser.family_name) parts.push(googleUser.family_name);
    if (parts.length > 0) return parts.join(' ').trim();
    // Last resort: use the local part of the email
    if (googleUser.email) {
      return googleUser.email.split('@')[0];
    }
    return 'Google User';
  }

  // Shared logic to find or create app user from Google profile
  private async findOrCreateUserFromGoogle(
    googleUser: any,
    isSignup = false,
    role?: string,
  ) {
    let user = await this.prisma.user.findUnique({
      where: { email: googleUser.email },
      include: USER_PROFILE_INCLUDE,
    });

    if (user && isSignup) {
      // When the client intends to sign up but the email already exists, prevent creating/overwriting
      throw new ConflictException('Email already registered');
    }

    if (!user) {
      const displayName = this.extractGoogleName(googleUser);
      this.logger.log(
        `Creating new Google user: email=${googleUser.email}, name="${displayName}", raw_name="${googleUser.name}", given_name="${googleUser.given_name}", family_name="${googleUser.family_name}"`,
      );

      // Try to create Supabase Auth user for Google users too
      const supabaseAuthId = await this.supabaseService.createAuthUser(
        googleUser.email,
        Math.random().toString(36).slice(-16) + 'A1!',
        {
          fullName: displayName,
          provider: 'google',
          role: role ?? 'CUSTOMER',
        },
      );

      user = await this.prisma.$transaction(async (tx) => {
        const userData: any = {
          email: googleUser.email,
          role: role ?? 'CUSTOMER',
        };

        if (supabaseAuthId) {
          userData.id = supabaseAuthId;
          this.logger.log(
            `Using Supabase Auth ID ${supabaseAuthId} for Google user ${googleUser.email}`,
          );
        }

        const newUser = await tx.user.create({ data: userData });

        const inputRole = role ?? 'CUSTOMER';

        const googleAvatar = googleUser.picture ?? null;

        if (inputRole === 'ADMIN') {
          await tx.admin.create({
            data: {
              id: newUser.id,
              fullName: displayName,
              phone: '',
              ...(googleAvatar ? { avatarUrl: googleAvatar } : {}),
            },
          });
        } else if (inputRole === 'DRIVER') {
          await tx.driver.create({
            data: {
              id: newUser.id,
              fullName: displayName,
              phone: '',
              vehicle: 'Not specified',
              ...(googleAvatar ? { avatarUrl: googleAvatar } : {}),
            },
          });
        } else {
          await tx.customer.create({
            data: {
              id: newUser.id,
              fullName: displayName,
              phone: '',
              type: 'HOUSEHOLD',
              ...(googleAvatar ? { avatarUrl: googleAvatar } : {}),
            } as any,
          });
        }

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
    } else {
      // Existing user — ensure a role-specific profile row exists.
      // Users who registered via email/password without a profile, or whose profile
      // was deleted, would otherwise have fullName=null forever.
      const hasProfile = (user as any).customer || (user as any).driver || (user as any).admin;
      if (!hasProfile) {
        const displayName = this.extractGoogleName(googleUser);
        this.logger.log(
          `Existing user ${user!.id} (${user!.email}) has no profile row — creating one with fullName="${displayName}"`,
        );
        try {
          if (user!.role === 'ADMIN') {
            await this.prisma.admin.create({
              data: { id: user!.id, fullName: displayName, phone: '' },
            });
          } else if (user!.role === 'DRIVER') {
            await this.prisma.driver.create({
              data: { id: user!.id, fullName: displayName, phone: '', vehicle: 'Not specified' },
            });
          } else {
            await this.prisma.customer.create({
              data: { id: user!.id, fullName: displayName, phone: '', type: 'HOUSEHOLD' } as any,
            });
          }
          // Re-fetch with profile included
          user = await this.prisma.user.findUnique({
            where: { id: user!.id },
            include: USER_PROFILE_INCLUDE,
          });
          await this.syncUserToSupabase(user);
        } catch (err) {
          this.logger.warn('Failed to create missing profile row for existing user', err as any);
        }
      }

      // Existing user — update avatar if Google provides one (or it changed).
      if (googleUser.picture) {
        try {
          const profile = (user as any).customer || (user as any).driver || (user as any).admin;
          const avatarFromDb = profile?.avatarUrl ?? null;
          if (avatarFromDb !== googleUser.picture) {
            const updateData = { avatarUrl: googleUser.picture } as any;
            if (user!.role === 'DRIVER') {
              await this.prisma.driver.update({ where: { id: user!.id }, data: updateData });
            } else if (user!.role === 'ADMIN') {
              await this.prisma.admin.update({ where: { id: user!.id }, data: updateData });
            } else {
              await this.prisma.customer.update({ where: { id: user!.id }, data: updateData });
            }

            // refresh the user object for return
            user = await this.prisma.user.findUnique({
              where: { id: user!.id },
              include: USER_PROFILE_INCLUDE,
            });

            // Sync updated avatar to Supabase as well
            const userWithProfile = await this.prisma.user.findUnique({
              where: { id: user!.id },
              include: { customer: true, driver: true, admin: true },
            });
            await this.syncUserToSupabase(userWithProfile ?? user);
          }
        } catch (err) {
          this.logger.warn(
            'Failed to update avatar for existing user',
            err as any,
          );
        }
      }

      // If Google provided a display name and the existing role-profile is missing a fullName
      // (null, empty, or the generic 'Google User' placeholder), populate it from Google.
      const displayName = this.extractGoogleName(googleUser);
      this.logger.log(
        `Existing Google user: email=${googleUser.email}, extracted name="${displayName}", raw_name="${googleUser.name}", given_name="${googleUser.given_name}", family_name="${googleUser.family_name}"`,
      );
      if (displayName && displayName !== 'Google User') {
        try {
          // Replace fullName if it's missing, a placeholder, or looks like an email prefix
          const needsName = (profileName: string | null | undefined) => {
            if (!profileName || profileName.trim() === '' || profileName === 'Google User') return true;
            // If the current name matches the local part of the email, replace with real name
            const emailPrefix = googleUser.email?.split('@')[0];
            if (emailPrefix && profileName === emailPrefix) return true;
            return false;
          };
          if ((user as any).customer && needsName((user as any).customer.fullName)) {
            this.logger.log(`Updating customer fullName to "${displayName}" for user ${user!.id}`);
            await this.prisma.customer.update({ where: { id: user!.id }, data: { fullName: displayName } as any });
            user = await this.prisma.user.findUnique({ where: { id: user!.id }, include: USER_PROFILE_INCLUDE });
            await this.syncUserToSupabase(user);
          } else if ((user as any).driver && needsName((user as any).driver.fullName)) {
            this.logger.log(`Updating driver fullName to "${displayName}" for user ${user!.id}`);
            await this.prisma.driver.update({ where: { id: user!.id }, data: { fullName: displayName } as any });
            user = await this.prisma.user.findUnique({ where: { id: user!.id }, include: USER_PROFILE_INCLUDE });
            await this.syncUserToSupabase(user);
          } else if ((user as any).admin && needsName((user as any).admin.fullName)) {
            this.logger.log(`Updating admin fullName to "${displayName}" for user ${user!.id}`);
            await this.prisma.admin.update({ where: { id: user!.id }, data: { fullName: displayName } as any });
            user = await this.prisma.user.findUnique({ where: { id: user!.id }, include: USER_PROFILE_INCLUDE });
            await this.syncUserToSupabase(user);
          } else {
            this.logger.log(`fullName already set for user ${user!.id}, skipping update`);
          }
        } catch (err) {
          this.logger.warn('Failed to populate fullName from Google for existing user', err as any);
        }
      }
    }

    // Block unapproved admins and drivers
    const freshUser = user as any;
    if (
      freshUser!.role === 'ADMIN' &&
      freshUser!.admin &&
      !freshUser!.admin.approved
    ) {
      throw new UnauthorizedException(
        'Your account is pending approval by a Super Admin.',
      );
    }
    if (
      freshUser!.role === 'DRIVER' &&
      freshUser!.driver &&
      !freshUser!.driver.approved
    ) {
      throw new UnauthorizedException(
        'Your account is pending approval by a Super Admin.',
      );
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

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
      avatar: flat.avatar ?? null,
    });
  }
}
