import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const toBool = (value?: string): boolean =>
  ['1', 'true', 'yes', 'on'].includes((value ?? '').trim().toLowerCase());

const toPositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly connectionUrlSource: 'DATABASE_URL' | 'DIRECT_URL' | 'UNSET';

  // Pass `DATABASE_URL` (e.g. Supabase Pooler URL) into PrismaClient so the
  // runtime uses the pooler connection string instead of the one compiled
  // into the generated client. This makes it easy to switch to Supabase
  // Pooler by setting the environment variable.
  constructor() {
    const databaseUrl = process.env.DATABASE_URL;
    const directUrl = process.env.DIRECT_URL;
    const preferDirect = toBool(process.env.PRISMA_PREFER_DIRECT_URL);
    const url = preferDirect
      ? directUrl ?? databaseUrl
      : databaseUrl ?? directUrl;
    const connectionUrlSource = !url
      ? 'UNSET'
      : preferDirect && directUrl
        ? 'DIRECT_URL'
        : 'DATABASE_URL';

    // If `url` is undefined, PrismaClient will fall back to the value used
    // when the client was generated (from .env at generate time). Passing
    // an explicit `datasources` object ensures the runtime connection uses
    // the provided URL when present.
    super({ datasources: { db: { url: url ?? undefined } } });

    this.connectionUrlSource = connectionUrlSource;

    if (connectionUrlSource === 'UNSET') {
      this.logger.warn(
        'No DATABASE_URL or DIRECT_URL detected at runtime. Prisma may use the URL embedded at generate time.',
      );
    } else {
      this.logger.log(`Using ${connectionUrlSource} for Prisma runtime connection.`);
    }
  }

  async onModuleInit() {
    const maxRetries = toPositiveInt(process.env.PRISMA_CONNECT_RETRIES, 6);
    const retryDelayMs = toPositiveInt(
      process.env.PRISMA_CONNECT_RETRY_DELAY_MS,
      2000,
    );

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        await this.$connect();
        if (attempt > 1) {
          this.logger.log(
            `Prisma connected on retry ${attempt}/${maxRetries}.`,
          );
        }
        return;
      } catch (error: unknown) {
        const isLastAttempt = attempt === maxRetries;
        const message =
          error instanceof Error ? error.message : 'Unknown Prisma error';

        if (isLastAttempt) {
          this.logger.error(
            `Prisma connection failed after ${maxRetries} attempts (${this.connectionUrlSource}).`,
            message,
          );
          throw error;
        }

        this.logger.warn(
          `Prisma connection attempt ${attempt}/${maxRetries} failed (${this.connectionUrlSource}). Retrying in ${retryDelayMs}ms.`,
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
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
