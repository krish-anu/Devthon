import { Inject, Injectable } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

@Injectable()
export class TransactionLogger {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: any,
  ) {}

  logTransaction(event: string, payload: Record<string, any>) {
    this.logger.info('transaction', {
      event,
      ...payload,
      timestamp: new Date().toISOString(),
    });
  }

  logError(event: string, error: Error, payload?: Record<string, any>) {
    this.logger.error('transaction_error', {
      event,
      message: error.message,
      stack: error.stack,
      ...(payload || {}),
      timestamp: new Date().toISOString(),
    });
  }
}
