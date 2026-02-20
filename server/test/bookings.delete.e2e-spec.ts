import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { RecaptchaService } from './../src/common/recaptcha.service';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Bookings delete (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  async function createAppWithRecaptchaMock(verifyResult: boolean) {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RecaptchaService)
      .useValue({ verify: async () => verifyResult })
      .compile();

    const _app = moduleFixture.createNestApplication();
    _app.setGlobalPrefix('api');
    _app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await _app.init();
    return _app;
  }

  afterEach(async () => {
    if (app) await app.close();
  });

  it('allows owner to delete booking and returns 404 afterwards', async () => {
    app = await createAppWithRecaptchaMock(true);
    prisma = app.get(PrismaService);

    // 1) Create user via register
    const email = `user+book+${Date.now()}@example.com`;
    const pw = 'PasswordA1';
    await request(app.getHttpServer()).post('/api/auth/register').send({
      fullName: 'Booking Owner',
      email,
      phone: '+94123456789',
      password: pw,
      type: 'HOUSEHOLD',
      recaptchaToken: 'valid',
    });

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: pw });
    const token = loginRes.body?.accessToken;
    expect(token).toBeDefined();

    const userId = loginRes.body.user.id;

    // 2) Ensure we have a waste category to reference
    const wc = await prisma.wasteCategory.create({
      data: { name: `wc-${Date.now()}`, description: 'test', isActive: true },
    });

    // 3) Create a booking record directly via prisma
    const booking = await prisma.booking.create({
      data: {
        userId,
        wasteCategoryId: wc.id,
        estimatedWeightRange: '1 kg',
        estimatedMinAmount: 10,
        estimatedMaxAmount: 20,
        addressLine1: '123 Test St',
        city: 'Colombo',
        postalCode: '10000',
        scheduledDate: new Date(),
        scheduledTimeSlot: '9-10am',
        status: 'SCHEDULED',
      },
    });

    // 4) Delete booking as owner
    await request(app.getHttpServer())
      .delete(`/api/bookings/${booking.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // 5) Confirm GET returns 404
    await request(app.getHttpServer())
      .get(`/api/bookings/${booking.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    // cleanup created data (in case)
    await prisma.booking
      .deleteMany({ where: { id: booking.id } })
      .catch(() => {});
    await prisma.wasteCategory.delete({ where: { id: wc.id } }).catch(() => {});
  });

  it('prevents other users from deleting the booking (403)', async () => {
    app = await createAppWithRecaptchaMock(true);
    prisma = app.get(PrismaService);

    // Create owner user
    const ownerEmail = `owner+${Date.now()}@example.com`;
    const ownerPw = 'PasswordA1';
    await request(app.getHttpServer()).post('/api/auth/register').send({
      fullName: 'Owner',
      email: ownerEmail,
      phone: '+94123456780',
      password: ownerPw,
      type: 'HOUSEHOLD',
      recaptchaToken: 'valid',
    });
    const ownerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: ownerEmail, password: ownerPw });
    const ownerId = ownerLogin.body.user.id;

    // Create attacker user
    const attackerEmail = `att+${Date.now()}@example.com`;
    const attackerPw = 'PasswordA1';
    await request(app.getHttpServer()).post('/api/auth/register').send({
      fullName: 'Attacker',
      email: attackerEmail,
      phone: '+94123456781',
      password: attackerPw,
      type: 'HOUSEHOLD',
      recaptchaToken: 'valid',
    });
    const attackerLoginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: attackerEmail, password: attackerPw });
    const attackerToken = attackerLoginRes.body.accessToken;

    // Create waste category and booking for owner
    const wc = await prisma.wasteCategory.create({
      data: { name: `wc-${Date.now()}`, description: 'test', isActive: true },
    });
    const booking = await prisma.booking.create({
      data: {
        userId: ownerId,
        wasteCategoryId: wc.id,
        estimatedWeightRange: '1 kg',
        estimatedMinAmount: 10,
        estimatedMaxAmount: 20,
        addressLine1: '123 Test St',
        city: 'Colombo',
        postalCode: '10000',
        scheduledDate: new Date(),
        scheduledTimeSlot: '9-10am',
        status: 'SCHEDULED',
      },
    });

    // Attempt to delete as attacker
    await request(app.getHttpServer())
      .delete(`/api/bookings/${booking.id}`)
      .set('Authorization', `Bearer ${attackerToken}`)
      .expect(403);

    // cleanup
    await prisma.booking
      .deleteMany({ where: { id: booking.id } })
      .catch(() => {});
    await prisma.wasteCategory.delete({ where: { id: wc.id } }).catch(() => {});
  });
});
