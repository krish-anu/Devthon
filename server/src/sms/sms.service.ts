import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendSmsDto {
  recipient: string; // comma-separated phone numbers
  message: string;
}

export interface SmsResponse {
  status: 'success' | 'error';
  data?: any;
  message?: string;
}

export interface SmsBalanceResponse {
  status: 'success' | 'error';
  data?: any;
  message?: string;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly apiBaseUrl = 'https://app.text.lk/api/v3';
  private readonly apiToken: string;
  private readonly senderId: string;

  constructor(private configService: ConfigService) {
    this.apiToken = this.configService.get<string>('TEXTLK_API_TOKEN') ?? '';
    this.senderId =
      this.configService.get<string>('TEXTLK_SENDER_ID') ?? 'TextLKDemo';
  }

  /**
   * Send SMS to one or more recipients via Text.lk API
   * @param recipient - comma separated phone numbers (e.g. "94710000000,94711111111")
   * @param message - SMS message body
   */
  async sendSms(recipient: string, message: string): Promise<SmsResponse> {
    const url = `${this.apiBaseUrl}/sms/send`;

    const body = {
      recipient,
      sender_id: this.senderId,
      type: 'plain',
      message,
    };

    this.logger.log(`Sending SMS to ${recipient} via Text.lk`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      this.logger.log(`Text.lk response: ${JSON.stringify(data)}`);

      if (data.status === 'success') {
        return { status: 'success', data: data.data };
      } else {
        return {
          status: 'error',
          message: data.message || 'Failed to send SMS',
        };
      }
    } catch (error) {
      this.logger.error(`Failed to send SMS: ${(error as Error).message}`);
      return { status: 'error', message: (error as Error).message };
    }
  }

  /**
   * Get remaining SMS balance from Text.lk
   */
  async getBalance(): Promise<SmsBalanceResponse> {
    const url = `${this.apiBaseUrl}/balance`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      const data = await response.json();
      return data;
    } catch (error) {
      this.logger.error(
        `Failed to get SMS balance: ${(error as Error).message}`,
      );
      return { status: 'error', message: (error as Error).message };
    }
  }
}
