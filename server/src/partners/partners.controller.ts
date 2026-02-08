import { Controller, Post, Body } from '@nestjs/common';
import { PartnersService } from './partners.service';
import { CreateRecyclerDto } from './dto/create-recycler.dto';
import { CreateCorporateDto } from './dto/create-corporate.dto';

@Controller('partners')
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Post('recycler')
  createRecycler(@Body() dto: CreateRecyclerDto) {
    return this.partnersService.createRecycler(dto);
  }

  @Post('corporate')
  createCorporate(@Body() dto: CreateCorporateDto) {
    return this.partnersService.createCorporate(dto);
  }
}
