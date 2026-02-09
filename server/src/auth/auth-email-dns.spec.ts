import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';

// Mock DNS lookups (default: no MX/A/AAAA records) to make tests deterministic and fast
jest.mock('dns/promises', () => ({
  resolveMx: jest.fn().mockRejectedValue(new Error('no mx')),
  resolve4: jest.fn().mockRejectedValue(new Error('no a')),
  resolve6: jest.fn().mockRejectedValue(new Error('no aaaa')),
}));

import { Controller, Post, Body } from '@nestjs/common';
import { OtpSendDto } from './dto/otp-send.dto';

// Minimal controller used for validation e2e checks to avoid booting entire AuthModule
@Controller('auth')
class TestAuthController {
  @Post('otp/send')
  sendOtp(@Body() dto: OtpSendDto) {
    return { success: true, message: 'OTP sent', email: dto.email };
  }
}

describe('Auth email DNS check (e2e)', () => {
  let app: INestApplication;

  async function createApp() {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TestAuthController],
    }).compile();

    app = moduleFixture.createNestApplication();
    // mimic app config from main.ts
    app.setGlobalPrefix('api');
    // Apply same validation pipe as in main.ts
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    return app;
  }

  afterEach(async () => {
    if (app) await app.close();
    // Reset env var between tests
    delete process.env.EMAIL_DNS_CHECK;
  });

  it('rejects fake domains when EMAIL_DNS_CHECK=true', async () => {
    process.env.EMAIL_DNS_CHECK = 'true';
    await createApp();

    const res = await request(app.getHttpServer())
      .post('/api/auth/otp/send')
      .send({ email: 'user@asdfqweqwe123.com' })
      .expect(400);

    expect(JSON.stringify(res.body)).toContain('Email domain cannot receive mail');
  });

  it('allows fake domains when EMAIL_DNS_CHECK=false', async () => {
    process.env.EMAIL_DNS_CHECK = 'false';
    await createApp();

    const res = await request(app.getHttpServer())
      .post('/api/auth/otp/send')
      .send({ email: 'user@asdfqweqwe123.com' })
      .expect(201);

    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('email', 'user@asdfqweqwe123.com');
  });
});
