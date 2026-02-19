import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { RecaptchaService } from './../src/common/recaptcha.service';

describe('Auth reCAPTCHA (e2e)', () => {
  let app: INestApplication;

  async function createAppWithRecaptchaMock(verifyResult: boolean) {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RecaptchaService)
      .useValue({ verify: async () => verifyResult })
      .compile();

    const _app = moduleFixture.createNestApplication();
    _app.setGlobalPrefix('api');
    _app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await _app.init();
    return _app;
  }

  afterEach(async () => {
    if (app) await app.close();
  });

  it('rejects admin registration when reCAPTCHA fails', async () => {
    app = await createAppWithRecaptchaMock(false);

    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        fullName: 'Bad Robot',
        email: 'admin+bot@example.com',
        phone: '+94123456789',
        password: 'PasswordA1',
        type: 'HOUSEHOLD',
        role: 'ADMIN',
        recaptchaToken: 'fake-token',
      })
      .expect(401);

    expect(JSON.stringify(res.body)).toContain('reCAPTCHA verification failed');
  });

  it('does not block registration when reCAPTCHA passes (no 401)', async () => {
    app = await createAppWithRecaptchaMock(true);

    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        fullName: 'Legit Admin',
        email: `admin+test+${Date.now()}@example.com`,
        phone: '+94123456789',
        password: 'PasswordA1',
        type: 'HOUSEHOLD',
        role: 'ADMIN',
        recaptchaToken: 'valid-token',
      });

    // We expect a non-401 response when reCAPTCHA passes. The exact success status may depend on DB availability in test environment.
    expect(res.status).not.toBe(401);
  });

  it('rejects login when reCAPTCHA fails', async () => {
    // 1) Create a user with recaptcha passing
    const email = `user+login+${Date.now()}@example.com`;
    const pw = 'PasswordA1';
    let setupApp = await createAppWithRecaptchaMock(true);
    await request(setupApp.getHttpServer())
      .post('/api/auth/register')
      .send({
        fullName: 'Login Tester',
        email,
        phone: '+94123456789',
        password: pw,
        type: 'HOUSEHOLD',
        recaptchaToken: 'valid-token',
      });
    await setupApp.close();

    // 2) Attempt to login with reCAPTCHA failing
    app = await createAppWithRecaptchaMock(false);

    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: pw, recaptchaToken: 'fake' })
      .expect(401);

    expect(JSON.stringify(res.body)).toContain('reCAPTCHA verification failed');
  });
});
