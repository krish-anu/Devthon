import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { WinstonModule, WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import * as winston from 'winston';
import 'winston-daily-rotate-file';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import cookieParser from 'cookie-parser';

// Polyfill: allow BigInt to be serialised by JSON.stringify (Prisma returns BigInt for Int8 columns)
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

async function bootstrap() {
  // Render a background-colored level badge using ANSI escapes for console output
  const levelBadge = (level: string) => {
    const L = (level || '').toLowerCase();
    switch (L) {
      case 'error':
        return `\x1b[41m ${level.toUpperCase()} \x1b[0m`; // red background
      case 'warn':
        return `\x1b[43m ${level.toUpperCase()} \x1b[0m`; // yellow background
      case 'info':
        return `\x1b[42m ${level.toUpperCase()} \x1b[0m`; // green background
      case 'debug':
        return `\x1b[44m ${level.toUpperCase()} \x1b[0m`; // blue background
      default:
        return `\x1b[45m ${level.toUpperCase()} \x1b[0m`; // magenta background
    }
  };
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger({
      transports: [
        // Console transport: human-friendly in non-production, JSON in production
        new winston.transports.Console({
          format:
            process.env.NODE_ENV === 'production'
              ? winston.format.combine(
                  winston.format.timestamp(),
                  winston.format.json(),
                )
              : winston.format.combine(
                  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                  winston.format.printf(
                    ({ timestamp, level, message, ...meta }) => {
                      const badge = levelBadge(level);
                      const msg =
                        typeof message === 'string'
                          ? message
                          : JSON.stringify(message);
                      let metaStr = '';
                      try {
                        const keys = Object.keys(meta || {});
                        if (keys.length)
                          metaStr = '\n' + JSON.stringify(meta, null, 2);
                      } catch (e) {
                        metaStr = String(meta);
                      }
                      return `${timestamp} ${badge} ${msg}${metaStr}`;
                    },
                  ),
                ),
        }),
        // File transport stays JSON for log processing and rotation
        new winston.transports.DailyRotateFile({
          filename: 'logs/trash2cash-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxFiles: '14d',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
        // Also write a human-readable rotated log (no JSON) for quick inspection
        new winston.transports.DailyRotateFile({
          filename: 'logs/trash2cash-readable-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxFiles: '14d',
          format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const lvl = (level || '').toUpperCase();
              const msg =
                typeof message === 'string' ? message : JSON.stringify(message);
              let metaStr = '';
              try {
                const keys = Object.keys(meta || {});
                if (keys.length) metaStr = '\n' + JSON.stringify(meta, null, 2);
              } catch (e) {
                metaStr = String(meta);
              }
              return `${timestamp} [${lvl}] ${msg}${metaStr}`;
            }),
          ),
        }),
      ],
    }),
  });

  // Register global request interceptor that uses the winston logger
  const winstonLogger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  app.useGlobalInterceptors(new RequestLoggingInterceptor(winstonLogger));
  // ensure every request has a trace id
  app.use(new RequestIdMiddleware().use as any);
  // global exception filter logs uncaught exceptions
  app.useGlobalFilters(new AllExceptionsFilter(winstonLogger));

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(','),
    credentials: true,
  });
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Trash2Cash API')
    .setDescription('REST API for Trash2Cash marketplace')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
