import { Test } from '@nestjs/testing';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

async function run() {
  const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
  console.log('Compiled module ok');
  // Try to get PrismaService
  try {
    const prisma = moduleFixture.get(PrismaService as any, { strict: false });
    console.log('PrismaService found (strict=false):', !!prisma);
  } catch (err: any) {
    console.error('PrismaService not found:', err?.message ?? err);
  }
}

run().catch((e) => { console.error(e); process.exit(1); });