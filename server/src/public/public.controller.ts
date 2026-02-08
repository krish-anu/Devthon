import { Body, Controller, Get, Post } from '@nestjs/common';
import { PublicService } from './public.service';
import { LaunchNotifyDto } from './dto/launch-notify.dto';
import { ClassifyImageDto } from './dto/classify-image.dto';

@Controller('public')
export class PublicController {
  constructor(private publicService: PublicService) {}

  @Get('pricing')
  getPricing() {
    return this.publicService.getPricing();
  }

  @Post('launch-notify')
  launchNotify(@Body() dto: LaunchNotifyDto) {
    return this.publicService.launchNotify(dto.email);
  }

  @Post('classify-image')
  classifyImage(@Body() dto: ClassifyImageDto) {
    return this.publicService.classifyImage(dto.imageBase64);
  }
}
