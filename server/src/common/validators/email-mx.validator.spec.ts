import { IsEmailDomainDeliverableConstraint } from './email-mx.validator';
import * as dns from 'dns/promises';

jest.mock('dns/promises');

const mockedDns = dns as jest.Mocked<typeof dns>;

describe('IsEmailDomainDeliverableConstraint', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns true when MX records exist', async () => {
    process.env.EMAIL_DNS_CHECK = 'true';
    mockedDns.resolveMx.mockResolvedValue([{ exchange: 'mx.example.com', priority: 10 }]);
    const c = new IsEmailDomainDeliverableConstraint();
    expect(await c.validate('user@example.com', null as any)).toBe(true);
  });

  it('falls back to A record when no MX', async () => {
    process.env.EMAIL_DNS_CHECK = 'true';
    mockedDns.resolveMx.mockRejectedValue(new Error('no mx'));
    mockedDns.resolve4.mockResolvedValue(['1.2.3.4']);
    const c = new IsEmailDomainDeliverableConstraint();
    expect(await c.validate('user@a.example', null as any)).toBe(true);
  });

  it('returns false when no MX or A/AAAA records', async () => {
    process.env.EMAIL_DNS_CHECK = 'true';
    mockedDns.resolveMx.mockRejectedValue(new Error('no mx'));
    mockedDns.resolve4.mockRejectedValue(new Error('no a'));
    mockedDns.resolve6.mockRejectedValue(new Error('no aaaa'));
    const c = new IsEmailDomainDeliverableConstraint();
    expect(await c.validate('user@nonexistentdomain.tld', null as any)).toBe(false);
    delete process.env.EMAIL_DNS_CHECK;
  });
});
