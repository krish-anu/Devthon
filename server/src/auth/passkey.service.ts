import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import type { User } from '@prisma/client';
import type { StringValue } from 'ms';
import { flattenUser, USER_PROFILE_INCLUDE } from '../common/utils/user.utils';

@Injectable()
export class PasskeyService implements OnModuleInit {
  private readonly logger = new Logger(PasskeyService.name);

  // Loaded dynamically because @simplewebauthn/server is ESM-only
  private webauthn: any;

  // In-memory challenge store with automatic expiry (5 min TTL)
  private challenges = new Map<
    string,
    { challenge: string; expiresAt: number }
  >();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /* ------------------------------------------------------------------ */
  /*  Lifecycle                                                          */
  /* ------------------------------------------------------------------ */

  async onModuleInit() {
    // Dynamic import for ESM-only package
    this.webauthn = await import('@simplewebauthn/server');
    this.logger.log('SimpleWebAuthn loaded successfully');

    // Periodically clean expired challenges every 5 min
    setInterval(() => this.cleanupChallenges(), 5 * 60 * 1000);
  }

  /* ------------------------------------------------------------------ */
  /*  Config helpers                                                     */
  /* ------------------------------------------------------------------ */

  private get rpName(): string {
    return this.configService.get<string>('PASSKEY_RP_NAME') || 'Trash2Cash';
  }

  private get rpId(): string {
    return this.configService.get<string>('PASSKEY_RP_ID') || 'localhost';
  }

  private get expectedOrigins(): string[] {
    const env = this.configService.get<string>('PASSKEY_ORIGIN');
    if (env) return env.split(',').map((o) => o.trim());

    // Fallback: derive from CORS_ORIGIN or default to localhost:3000
    const cors = this.configService.get<string>('CORS_ORIGIN');
    return cors ? [cors] : ['http://localhost:3000'];
  }

  /* ------------------------------------------------------------------ */
  /*  Challenge store (single-use, 5-min TTL)                            */
  /* ------------------------------------------------------------------ */

  private storeChallenge(key: string, challenge: string) {
    this.challenges.set(key, {
      challenge,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
  }

  private consumeChallenge(key: string): string {
    const entry = this.challenges.get(key);
    if (!entry) {
      throw new UnauthorizedException('Challenge not found – please retry');
    }
    if (Date.now() > entry.expiresAt) {
      this.challenges.delete(key);
      throw new UnauthorizedException('Challenge expired – please retry');
    }
    this.challenges.delete(key); // single-use
    return entry.challenge;
  }

  private cleanupChallenges() {
    const now = Date.now();
    for (const [key, val] of this.challenges) {
      if (now > val.expiresAt) this.challenges.delete(key);
    }
  }

  /* ================================================================== */
  /*  REGISTRATION  (user must be authenticated)                         */
  /* ================================================================== */

  async generateRegistrationOptions(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { passkeyCredentials: true, ...USER_PROFILE_INCLUDE },
    });
    if (!user) throw new NotFoundException('User not found');

    const displayName = user.customer?.fullName ?? user.admin?.fullName ?? user.driver?.fullName ?? user.email;

    const options = await this.webauthn.generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpId,
      userID: new TextEncoder().encode(user.id),
      userName: user.email,
      userDisplayName: displayName,
      attestationType: 'none', // privacy-friendly; no attestation needed
      excludeCredentials: user.passkeyCredentials.map((c: any) => ({
        id: c.credentialId,
        transports: c.transports,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    this.storeChallenge(`reg:${userId}`, options.challenge);
    return options;
  }

  async verifyRegistration(userId: string, body: any) {
    const expectedChallenge = this.consumeChallenge(`reg:${userId}`);

    const verification = await this.webauthn.verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: this.expectedOrigins,
      expectedRPID: this.rpId,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new UnauthorizedException(
        'Passkey registration verification failed',
      );
    }

    const { credential } = verification.registrationInfo;

    await this.prisma.passkeyCredential.create({
      data: {
        userId,
        credentialId: credential.id,
        credentialPublicKey: Buffer.from(credential.publicKey),
        counter: BigInt(credential.counter),
        transports: credential.transports ?? [],
      },
    });

    this.logger.log(`Passkey registered for user ${userId}`);
    return { verified: true };
  }

  /* ================================================================== */
  /*  AUTHENTICATION  (no prior auth required)                           */
  /* ================================================================== */

  async generateAuthenticationOptions(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { passkeyCredentials: true },
    });

    if (!user || user.passkeyCredentials.length === 0) {
      throw new NotFoundException('No passkeys registered for this account');
    }

    const options = await this.webauthn.generateAuthenticationOptions({
      rpID: this.rpId,
      allowCredentials: user.passkeyCredentials.map((c: any) => ({
        id: c.credentialId,
        transports: c.transports,
      })),
      userVerification: 'preferred',
    });

    this.storeChallenge(`auth:${email}`, options.challenge);
    return options;
  }

  async verifyAuthentication(email: string, credential: any) {
    const expectedChallenge = this.consumeChallenge(`auth:${email}`);

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { passkeyCredentials: true, ...USER_PROFILE_INCLUDE },
    });
    if (!user) throw new UnauthorizedException('User not found');

    // Match the browser's credential.id against stored credentials
    const stored = user.passkeyCredentials.find(
      (c: any) => c.credentialId === credential.id,
    );
    if (!stored) {
      throw new UnauthorizedException('Credential not recognised');
    }

    const verification = await this.webauthn.verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: this.expectedOrigins,
      expectedRPID: this.rpId,
      credential: {
        id: stored.credentialId,
        publicKey: new Uint8Array(stored.credentialPublicKey),
        counter: Number(stored.counter),
        transports: stored.transports,
      },
    });

    if (!verification.verified) {
      throw new UnauthorizedException('Passkey authentication failed');
    }

    // Update the signature counter (replay-attack protection)
    await this.prisma.passkeyCredential.update({
      where: { id: stored.id },
      data: { counter: BigInt(verification.authenticationInfo.newCounter) },
    });

    // Issue JWT tokens (same as normal login)
    const tokens = await this.issueTokens(user);
    return { user: flattenUser(user), ...tokens };
  }

  /* ================================================================== */
  /*  MANAGEMENT  (user must be authenticated)                           */
  /* ================================================================== */

  async listPasskeys(userId: string) {
    return this.prisma.passkeyCredential.findMany({
      where: { userId },
      select: {
        id: true,
        deviceName: true,
        createdAt: true,
        transports: true,
      },
    });
  }

  async deletePasskey(userId: string, passkeyId: string) {
    const cred = await this.prisma.passkeyCredential.findFirst({
      where: { id: passkeyId, userId },
    });
    if (!cred) throw new NotFoundException('Passkey not found');

    await this.prisma.passkeyCredential.delete({
      where: { id: passkeyId },
    });
    this.logger.log(`Passkey ${passkeyId} deleted for user ${userId}`);
    return { success: true };
  }

  /* ------------------------------------------------------------------ */
  /*  Private helpers                                                    */
  /* ------------------------------------------------------------------ */

  private async issueTokens(user: User) {
    const payload = { sub: user.id, role: user.role };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: (this.configService.get<string>('JWT_ACCESS_EXPIRES') ||
        '15m') as StringValue,
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRES') ||
        '7d') as StringValue,
    });

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash },
    });

    return { accessToken, refreshToken };
  }
}
