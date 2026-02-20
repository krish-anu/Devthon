import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import dns from 'dns/promises';

const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const cache = new Map<string, { valid: boolean; ts: number }>();

@ValidatorConstraint({ async: true })
export class EmailDeliverableConstraint implements ValidatorConstraintInterface {
  async validate(value: any) {
    if (typeof value !== 'string') return false;
    const at = value.lastIndexOf('@');
    if (at === -1) return false;

    const domain = value.slice(at + 1).toLowerCase();
    if (!domain) return false;

    const now = Date.now();
    const cached = cache.get(domain);
    if (cached && now - cached.ts < CACHE_TTL) return cached.valid;

    let valid = false;

    // Try MX first
    try {
      const mx = await dns.resolveMx(domain);
      if (mx && mx.length) {
        valid = true;
      } else {
        // fallback to A/AAAA
        valid = await this.checkARecords(domain);
      }
    } catch (err) {
      // MX lookup failed or no records -> fallback to A/AAAA
      valid = await this.checkARecords(domain);
    }

    cache.set(domain, { valid, ts: now });
    return valid;
  }

  async checkARecords(domain: string) {
    try {
      const a = await dns.resolve4(domain);
      if (a && a.length) return true;
    } catch (e) {
      // ignore
    }
    try {
      const a6 = await dns.resolve6(domain);
      if (a6 && a6.length) return true;
    } catch (e) {
      // ignore
    }
    return false;
  }

  defaultMessage() {
    return 'Email domain cannot receive mail (no MX or A/AAAA records found)';
  }
}

export function IsDeliverableEmail(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isDeliverableEmail',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: EmailDeliverableConstraint,
    });
  };
}
