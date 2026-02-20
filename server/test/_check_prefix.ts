import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

async function run() {
  const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  await app.init();

  const r1 = await request(app.getHttpServer()).post('/auth/register').send({});
  console.log('/auth/register', r1.status, r1.body);
  const r2 = await request(app.getHttpServer()).post('/api/auth/register').send({});
  console.log('/api/auth/register', r2.status, r2.body);

  await app.close();
}

run().catch((e) => { console.error(e); process.exit(1); });