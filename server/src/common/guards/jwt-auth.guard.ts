import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
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
