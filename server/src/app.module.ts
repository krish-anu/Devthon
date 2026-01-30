import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import 'winston-daily-rotate-file';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PublicModule } from './public/public.module';
import { BookingsModule } from './bookings/bookings.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';
import { SearchModule } from './search/search.module';
import { GeminiModule } from './gemini/gemini.module';
import { TransactionLogger } from './common/logger/transaction-logger.service';
import { LoggingModule } from './common/logger/logger.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Cache: prefer Redis if REDIS_URL provided, otherwise in-memory cache
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: (): any => {
        const redisUrl = process.env.REDIS_URL;
        if (redisUrl) {
          try {
            // lazy require to avoid hard dependency if not installed
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const redisStore = require('cache-manager-redis-store');
            return {
              store: redisStore,
              url: redisUrl,
              ttl: 60 * 60 * 24,
            };
          } catch (e) {
            console.warn(
              'cache-manager-redis-store not available, using in-memory cache',
            );
          }
        }
        return { ttl: 60 * 60 * 24 };
      },
    }),
    ThrottlerModule.forRoot({ ttl: 60, limit: 30 }),
    WinstonModule.forRoot({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
        new winston.transports.DailyRotateFile({
          filename: 'logs/trash2cash-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxFiles: '14d',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      ],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    PublicModule,
    BookingsModule,
    NotificationsModule,
    SearchModule,
    GeminiModule,
    AdminModule,
    LoggingModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
