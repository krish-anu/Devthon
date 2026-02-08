import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>('JWT_ACCESS_SECRET');
    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET is not set');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret,
    });
  }

  validate(payload: {
    sub: string;
    role: string;
    iat?: number;
    exp?: number;
    [key: string]: any;
  }) {
    // Convert iat/exp (seconds) to readable ISO timestamps for downstream use
    const result = { ...payload } as any;
    try {
      if (typeof payload.iat === 'number') {
        result.iatReadable = new Date(payload.iat * 1000).toISOString();
      }
      if (typeof payload.exp === 'number') {
        result.expReadable = new Date(payload.exp * 1000).toISOString();
      }
    } catch (e) {
      console.warn('Failed to parse iat/exp in JWT payload', e);
    }

    // Log payload for debugging auth failures (temporary)

    console.debug('JwtStrategy validate payload:', result);
    return result;
  }
}
