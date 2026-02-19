import { Controller, Get } from '@nestjs/common';
import { WasteTypesService } from './waste-types.service';

@Controller('waste-types')
export class WasteTypesController {
  constructor(private wasteTypesService: WasteTypesService) {}

  @Get()
  listWasteTypes() {
    return this.wasteTypesService.listWasteTypes();
  }
}
