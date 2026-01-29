import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Inject } from '@nestjs/common';

@Catch()
@Injectable()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: any,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest();
    const res = ctx.getResponse();
    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;
    const traceId =
      (req.headers &&
        (req.headers['x-request-id'] || req.headers['x-request-id'])) ||
      undefined;

    const payload = {
      message:
        exception instanceof Error ? exception.message : String(exception),
      status,
      path: req?.url,
      method: req?.method,
      traceId,
      stack: exception instanceof Error ? exception.stack : undefined,
    };

    if (this.logger && typeof this.logger.error === 'function') {
      this.logger.error('Unhandled Exception', payload);
    } else if (this.logger && typeof this.logger.log === 'function') {
      this.logger.log(`Unhandled Exception ${JSON.stringify(payload)}`);
    }

    try {
      res.status(status).json({ statusCode: status, message: payload.message });
    } catch (err) {
      // ignore response errors during logging
    }
  }
}
