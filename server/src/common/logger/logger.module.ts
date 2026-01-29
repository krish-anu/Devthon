import { Global, Module } from '@nestjs/common';
import { TransactionLogger } from './transaction-logger.service';

@Global()
@Module({
  providers: [TransactionLogger],
  exports: [TransactionLogger],
})
export class LoggingModule {}
