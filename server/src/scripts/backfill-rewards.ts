import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { RewardsService } from '../rewards/rewards.service';

function readLimitArg() {
  const arg = process.argv.find((item) => item.startsWith('--limit='));
  if (!arg) return 1000;
  const raw = Number(arg.split('=')[1]);
  if (!Number.isFinite(raw) || raw <= 0) return 1000;
  return Math.floor(raw);
}

async function main() {
  const limit = readLimitArg();
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const rewardsService = app.get(RewardsService);
    const result = await rewardsService.backfillMissingPoints(limit);

    console.log('Rewards backfill result:', result);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error('Rewards backfill failed:', error);
  process.exit(1);
});
