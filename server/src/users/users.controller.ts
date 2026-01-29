import {
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UseGuards,
  Post,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  getMe(@Req() req: any) {
    return this.usersService.getMe(req.user.sub);
  }

  @Patch('me')
  updateMe(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateMe(req.user.sub, dto);
  }

  @Post('me/password')
  changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(req.user.sub, dto);
  }
}
