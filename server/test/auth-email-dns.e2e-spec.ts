import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Auth email DNS check (e2e)', () => {
  let app: INestApplication;

  async function createApp() {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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

  it('rejects fake domains by default (DNS check enabled)', async () => {
    // Ensure DNS check enabled for this test
    process.env.EMAIL_DNS_CHECK = 'true';
    await createApp();

    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'user@asdfqweqwe123.com', password: 'test-password' })
      .expect(400);

    expect(JSON.stringify(res.body)).toContain('Email domain cannot receive mail');
  });

  it('allows fake domains when EMAIL_DNS_CHECK=false', async () => {
    process.env.EMAIL_DNS_CHECK = 'false';
    await createApp();

    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'user@asdfqweqwe123.com', password: 'test-password' })
      .expect(401);

    expect(JSON.stringify(res.body)).not.toContain('Email domain cannot receive mail');
  });
});
