import { Module } from '@nestjs/common';
import { WasteTypesController } from './waste-types.controller';
import { WasteTypesService } from './waste-types.service';

@Module({
  controllers: [WasteTypesController],
  providers: [WasteTypesService],
})
export class WasteTypesModule {}
