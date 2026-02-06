import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import 'winston-daily-rotate-file';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CacheExampleService } from './common/cache/cache-example.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PublicModule } from './public/public.module';
import { BookingsModule } from './bookings/bookings.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';
// Search and Gemini modules removed (AI/search functionality)
import { TransactionLogger } from './common/logger/transaction-logger.service';
import { LoggingModule } from './common/logger/logger.module';
import { ChatModule } from './chat/chat.module';
import { SupabaseModule } from './common/supabase/supabase.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Cache: in-memory cache configuration
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService): Promise<any> => {
        const ttlEnv = configService.get<string>('CACHE_TTL');
        // Default to a day for in-memory cache when not specified
        const ttl = ttlEnv ? parseInt(ttlEnv, 10) : 60 * 60 * 24;
        return { ttl };
      },
    }),
    // Provide throttlers as an array to match ThrottlerGuard expectations
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60, limit: 30 }] } as any),
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
    SupabaseModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    PublicModule,
    BookingsModule,
    NotificationsModule,
    // SearchModule,
    // GeminiModule,
    AdminModule,
    LoggingModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    CacheExampleService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: CacheInterceptor },
  ],
})
export class AppModule {}
