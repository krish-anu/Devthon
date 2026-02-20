import { RecaptchaService } from '../src/common/recaptcha.service';

describe('RecaptchaService', () => {
  const mockConfig: any = { get: jest.fn() };
  const origFetch = globalThis.fetch;

  beforeEach(() => {
    jest.resetAllMocks();
    globalThis.fetch = jest.fn();
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  it('skips verification when RECAPTCHA_SECRET is not set', async () => {
    mockConfig.get.mockImplementation((key: string) => undefined);
    const svc = new RecaptchaService(mockConfig);
    const ok = await svc.verify(null);
    expect(ok).toBe(true);
  });

  it('returns false when no token is provided but secret exists', async () => {
    mockConfig.get.mockImplementation((key: string) =>
      key === 'RECAPTCHA_SECRET' ? 'secret' : undefined,
    );
    const svc = new RecaptchaService(mockConfig);
    const ok = await svc.verify(null);
    expect(ok).toBe(false);
  });

  it('validates score and action - passes when above minScore', async () => {
    mockConfig.get.mockImplementation((key: string) => {
      if (key === 'RECAPTCHA_SECRET') return 'secret';
      if (key === 'RECAPTCHA_MIN_SCORE') return '0.7';
      return undefined;
    });
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, score: 0.8, action: 'admin_signup' }),
    });
    const svc = new RecaptchaService(mockConfig);
    const ok = await svc.verify('token', 'admin_signup');
    expect(ok).toBe(true);
  });

  it('fails when score below threshold', async () => {
    mockConfig.get.mockImplementation((key: string) =>
      key === 'RECAPTCHA_SECRET' ? 'secret' : undefined,
    );
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, score: 0.3, action: 'admin_signup' }),
    });
    const svc = new RecaptchaService(mockConfig);
    const ok = await svc.verify('token', 'admin_signup');
    expect(ok).toBe(false);
  });
});
