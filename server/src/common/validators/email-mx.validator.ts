import { registerDecorator, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';
import { resolveMx, resolve4, resolve6 } from 'dns/promises';

const cache = new Map<string, { expires: number; ok: boolean }>();
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

async function domainCanReceiveMail(domain: string): Promise<boolean> {
  const now = Date.now();
  const cached = cache.get(domain);
  if (cached && cached.expires > now) return cached.ok;

  let ok = false;

  try {
    const mx = await resolveMx(domain);
    if (mx && mx.length > 0) ok = true;
  } catch (err) {
    // ignore and fallback to A/AAAA lookup
  }

  if (!ok) {
    try {
      const a = await resolve4(domain);
      if (a && a.length > 0) ok = true;
    } catch (err) {
      // ignore
    }
  }

  if (!ok) {
    try {
      const aaaa = await resolve6(domain);
      if (aaaa && aaaa.length > 0) ok = true;
    } catch (err) {
      // ignore
    }
  }

  cache.set(domain, { expires: now + CACHE_TTL, ok });
  return ok;
}

@ValidatorConstraint({ async: true })
export class IsEmailDomainDeliverableConstraint implements ValidatorConstraintInterface {
  async validate(value: any, _args: ValidationArguments) {
    // Env toggle: default disabled (for local development)
    // Only perform DNS checks when this is explicitly set to 'true'
    const emailDnsCheckEnabled = process.env.EMAIL_DNS_CHECK === 'true';
    if (!emailDnsCheckEnabled) return true;

    if (typeof value !== 'string') return false;
    const at = value.lastIndexOf('@');
    if (at === -1) return false;
    const domain = value.slice(at + 1).toLowerCase();
    // quick reject for obviously invalid domains
    if (!domain || domain.length > 255) return false;

    try {
      return await domainCanReceiveMail(domain);
    } catch (err) {
      // On DNS errors be conservative: treat as not deliverable
      return false;
    }
  }

  defaultMessage(_args: ValidationArguments) {
    return 'Email domain cannot receive mail';
  }
}

export function IsEmailDomainDeliverable(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsEmailDomainDeliverableConstraint,
    });
  };
}
