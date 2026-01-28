import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
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
    super({ datasources: { db: { url: url ?? undefined } } });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
