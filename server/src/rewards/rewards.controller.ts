import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RewardsService } from './rewards.service';

@UseGuards(JwtAuthGuard)
@Controller('rewards')
export class RewardsController {
  constructor(private rewardsService: RewardsService) {}

  @Get('me')
  getMyRewards(@Req() req: any) {
    return this.rewardsService.getMyRewards(req.user.sub);
  }
}
