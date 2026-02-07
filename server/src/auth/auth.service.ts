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

<<<<<<< HEAD
=======
  private sanitizeUser(user: any) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, refreshTokenHash, customer, admin, driver, ...safe } = user as any;

    // Merge profile fields for backward compatibility
    safe.fullName = customer?.fullName ?? admin?.fullName ?? driver?.fullName ?? safe.fullName;
    safe.phone = customer?.phone ?? admin?.phone ?? driver?.phone ?? safe.phone;
    safe.type = customer?.type ?? safe.type;
    safe.status = customer?.status ?? safe.status;
    return safe;
  }

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
=======
    const supabaseAuthId = await this.supabaseService.createAuthUser(dto.email, dto.password, {
      fullName: dto.fullName,
      phone: dto.phone,
      type: dto.type,
      role: dto.role ?? 'CUSTOMER',
    });

    // Create auth user
    const userData: any = { email: dto.email, passwordHash, role: dto.role ?? 'CUSTOMER' };
    if (supabaseAuthId) {
      userData.id = supabaseAuthId;
      this.logger.log(`Using Supabase Auth ID ${supabaseAuthId} for new user ${dto.email}`);
    }
>>>>>>> 30208fe (Refactor user model and related tables for role-based access control; implement Supabase Auth for user creation and update seeding logic for new structure)

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

    // Create profile record for customer
    await this.prisma.customer.create({ data: { id: user.id, fullName: dto.fullName, phone: dto.phone, type: dto.type, status: 'ACTIVE' } });

<<<<<<< HEAD
    const tokens = await this.issueTokens(user!);
    return { user: flattenUser(user), ...tokens };
=======
    // Fetch user with related profiles for syncing and returning
    const createdUser = await this.prisma.user.findUnique({ where: { id: user.id }, include: { customer: true, admin: true, driver: true } });

    // Sync user row to Supabase DB (if configured)
    await this.syncUserToSupabase(createdUser ?? user);

    const tokens = await this.issueTokens(createdUser ?? user);
    return { user: this.sanitizeUser(createdUser ?? user), ...tokens };
>>>>>>> 30208fe (Refactor user model and related tables for role-based access control; implement Supabase Auth for user creation and update seeding logic for new structure)
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
=======

    // Fetch related profile before returning
    const userWithProfile = await this.prisma.user.findUnique({ where: { id: user.id }, include: { customer: true, admin: true, driver: true } });

    const tokens = await this.issueTokens(userWithProfile ?? user);
    return { user: this.sanitizeUser(userWithProfile ?? user), ...tokens };
>>>>>>> 30208fe (Refactor user model and related tables for role-based access control; implement Supabase Auth for user creation and update seeding logic for new structure)
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

<<<<<<< HEAD
      user = await this.prisma.$transaction(async (tx) => {
        const userData: any = {
          email: googleUser.email,
          role: 'CUSTOMER',
        };
=======
      const userData: any = { email: googleUser.email, passwordHash: '', role: 'CUSTOMER' };
>>>>>>> 30208fe (Refactor user model and related tables for role-based access control; implement Supabase Auth for user creation and update seeding logic for new structure)

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

      // Create a default customer profile
      await this.prisma.customer.create({ data: { id: user.id, fullName: googleUser.name || 'Google User', phone: '', type: 'HOUSEHOLD', status: 'ACTIVE' } });

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
<<<<<<< HEAD
    const flat = flattenUser(user);
    await this.supabaseService.upsertRow('users', {
      id: flat.id,
      email: flat.email,
      role: flat.role,
      fullName: flat.fullName,
      phone: flat.phone,
      address: flat.address,
=======
    // Ensure we have profile fields available
    const u =
      user?.customer || user?.admin || user?.driver
        ? user
        : await this.prisma.user.findUnique({ where: { id: user.id }, include: { customer: true, admin: true, driver: true } });

    const profileFullName = u?.customer?.fullName ?? u?.admin?.fullName ?? u?.driver?.fullName ?? undefined;
    const profilePhone = u?.customer?.phone ?? u?.admin?.phone ?? u?.driver?.phone ?? undefined;
    const profileType = u?.customer?.type ?? undefined;
    const profileStatus = u?.customer?.status ?? undefined;

    await this.supabaseService.upsertRow('users', {
      id: u.id,
      fullName: profileFullName,
      email: u.email,
      phone: profilePhone,
      role: u.role,
      type: profileType,
      status: profileStatus,
      address: undefined,
>>>>>>> 30208fe (Refactor user model and related tables for role-based access control; implement Supabase Auth for user creation and update seeding logic for new structure)
    });
  }
}
