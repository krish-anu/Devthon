import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  // Allow public routes (marked with @Public) to bypass auth
  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  // Override to log auth failures (info contains passport failure details)
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err) {
      console.error('JwtAuthGuard error:', err);
      throw err;
    }

    if (!user) {
      console.debug('JwtAuthGuard no user - auth failed, info:', info);
      throw new UnauthorizedException();
    }

    return user;
  }
}
