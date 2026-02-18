import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  private static withTimeoutParams(url: string) {
    try {
      const parsed = new URL(url);
      if (!parsed.searchParams.has('connect_timeout')) {
        parsed.searchParams.set('connect_timeout', '10');
      }
      if (!parsed.searchParams.has('pool_timeout')) {
        parsed.searchParams.set('pool_timeout', '10');
      }
      return parsed.toString();
    } catch {
      // If URL parsing fails, keep the original URL unchanged.
      return url;
    }
  }

  // Pass `DATABASE_URL` (e.g. Supabase Pooler URL) into PrismaClient so the
  // runtime uses the pooler connection string instead of the one compiled
  // into the generated client. This makes it easy to switch to Supabase
  // Pooler by setting the environment variable.
  constructor() {
    const url = process.env.DATABASE_URL;
    // If `url` is undefined, PrismaClient will fall back to the value used
    // when the client was generated (from .env at generate time). Passing
    // an explicit `datasources` object ensures the runtime connection uses
    // the provided URL when present.
    const runtimeUrl = url ? PrismaService.withTimeoutParams(url) : undefined;
    super({ datasources: { db: { url: runtimeUrl } } });
  }

  async onModuleInit() {
    await this.$connect();
    await this.ensureSchemaCompatibility();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Protects runtime against partially-applied migrations in long-lived dev DBs.
   * These statements are idempotent and safe to run on every startup.
   */
  private async ensureSchemaCompatibility() {
    const statements = [
      `ALTER TABLE "PointsTransaction" ADD COLUMN IF NOT EXISTS "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1`,
      `ALTER TABLE "PointsTransaction" ADD COLUMN IF NOT EXISTS "reason" JSONB`,
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totalPoints" INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3)`,
    ];

    for (const statement of statements) {
      try {
        await this.$executeRawUnsafe(statement);
      } catch (error) {
        this.logger.warn(
          `Schema compatibility step failed: ${statement}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }
}
