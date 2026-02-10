import { Module } from '@nestjs/common';
import { RewardsService } from './rewards.service';
import { RewardsController } from './rewards.controller';
import { LeaderboardController } from './leaderboard.controller';

@Module({
  controllers: [RewardsController, LeaderboardController],
  providers: [RewardsService],
  exports: [RewardsService],
})
export class RewardsModule {}
