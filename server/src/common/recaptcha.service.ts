import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RecaptchaService {
  private readonly logger = new Logger(RecaptchaService.name);
  private readonly minScore: number;

  constructor(private configService: ConfigService) {
    const m = this.configService.get<string>('RECAPTCHA_MIN_SCORE');
    this.minScore = m ? parseFloat(m) : 0.5;
  }

  async verify(token: string | undefined | null, action?: string) {
    const secret = this.configService.get<string>('RECAPTCHA_SECRET');

    // If secret isn't configured, treat verification as passed (useful for local/dev)
    if (!secret) {
      this.logger.warn('RECAPTCHA_SECRET not set — skipping verification');
      return true;
    }

    if (!token) {
      this.logger.warn('No reCAPTCHA token provided');
      return false;
    }

    const params = new URLSearchParams({ secret, response: token });

    try {
      const r = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      if (!r.ok) {
        this.logger.warn('reCAPTCHA verification request failed', r.statusText);
        return false;
      }
      const json = await r.json();
      const success = Boolean(json.success);
      const score = typeof json.score === 'number' ? json.score : 1;
      const actionMatches = !action || json.action === action;

      const passed = success && actionMatches && score >= this.minScore;

      if (!passed) {
        this.logger.warn('reCAPTCHA verification failed', { success: json.success, score: json.score, action: json.action, minScore: this.minScore });
      }

      return passed;
    } catch (err) {
      this.logger.warn('reCAPTCHA verification error', err as any);
      return false;
    }
  }
}
