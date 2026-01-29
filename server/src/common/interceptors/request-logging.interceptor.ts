import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: any) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    const req = context.switchToHttp().getRequest();
    const method = req.method;
    const url = req.originalUrl || req.url;
    const traceId =
      req.headers['x-request-id'] || `${Date.now()}-${Math.random()}`;

    return next.handle().pipe(
      tap({
        next: (res) => {
          const ms = Date.now() - now;
          const status = context.switchToHttp().getResponse()?.statusCode;
          const payload = {
            context: context.getClass().name,
            method,
            url,
            status,
            durationMs: ms,
            traceId,
          };
          if (typeof this.logger.info === 'function') {
            this.logger.info('HTTP Request', payload);
          } else if (typeof this.logger.log === 'function') {
            this.logger.log(`HTTP Request ${JSON.stringify(payload)}`);
          }
        },
        error: (err) => {
          const ms = Date.now() - now;
          const payload = {
            context: context.getClass().name,
            method,
            url,
            durationMs: ms,
            traceId,
            message: err?.message,
            stack: err?.stack,
          };
          if (typeof this.logger.error === 'function') {
            this.logger.error('HTTP Request Error', payload);
          } else if (typeof this.logger.log === 'function') {
            this.logger.log(`HTTP Request Error ${JSON.stringify(payload)}`);
          }
        },
      }),
    );
  }
}
