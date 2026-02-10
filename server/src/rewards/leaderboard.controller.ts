import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RewardsService } from './rewards.service';

@UseGuards(JwtAuthGuard)
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private rewardsService: RewardsService) {}

  @Get('monthly')
  getMonthlyLeaderboard(@Query('yearMonth') yearMonth?: string) {
    return this.rewardsService.getMonthlyLeaderboard(yearMonth);
  }

  @Get('overall')
  getOverallLeaderboard() {
    return this.rewardsService.getOverallLeaderboard();
  }
}
