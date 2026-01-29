import { Inject, Injectable } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

@Injectable()
export class TransactionLogger {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: any,
  ) {}

  private safeLog(
    level: 'info' | 'error' | 'warn' | 'debug',
    message: string,
    meta?: Record<string, any>,
  ) {
    const payload = meta || {};
    try {
      if (this.logger && typeof this.logger.log === 'function') {
        // Try object form first (winston-like): logger.log({ level, message, ...meta })
        try {
          this.logger.log({ level, message, ...payload });
          return;
        } catch {
          // Fallback to signature logger.log(level, message, meta)
          try {
            this.logger.log(level, message, payload);
            return;
          } catch {}
        }
      }

      if (this.logger && typeof this.logger[level] === 'function') {
        // Some logger implementations expose .info/.error
        this.logger[level](message, payload);
        return;
      }

      if (this.logger && typeof this.logger.log === 'function') {
        // As a last attempt, pass message and meta
        this.logger.log(message, payload);
        return;
      }
    } catch (e) {
      // ignore and fallthrough to console
    }

    // Final fallback
    // eslint-disable-next-line no-console
    if (level === 'error') console.error(message, payload);
    else console.log(`${level.toUpperCase()} ${message}`, payload);
  }

  logTransaction(event: string, payload: Record<string, any>) {
    this.safeLog('info', 'transaction', {
      event,
      ...payload,
      timestamp: new Date().toISOString(),
    });
  }

  logError(event: string, error: Error, payload?: Record<string, any>) {
    this.safeLog('error', 'transaction_error', {
      event,
      message: error?.message,
      stack: error?.stack,
      ...(payload || {}),
      timestamp: new Date().toISOString(),
    });
  }
}
