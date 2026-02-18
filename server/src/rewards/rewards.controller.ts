import {
  Controller,
  Get,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RewardsService } from './rewards.service';

type AuthRequest = {
  user?: {
    sub?: string;
    id?: string;
  };
};

@UseGuards(JwtAuthGuard)
@Controller('rewards')
export class RewardsController {
  constructor(private rewardsService: RewardsService) {}

  private getUserId(req: AuthRequest) {
    const userId = req.user?.sub ?? req.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return userId;
  }

  @Get('me')
  getMyRewards(@Req() req: AuthRequest) {
    return this.rewardsService.getMyRewards(this.getUserId(req));
  }
}
