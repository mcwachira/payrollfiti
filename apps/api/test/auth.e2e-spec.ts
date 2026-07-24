import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { describe, it, beforeAll, afterAll, expect } from '@jest/globals';
import request from 'supertest';
import { AppModule } from './../src/app.module';

// Smoke-tests the full signup -> login -> refresh -> logout -> refresh-fails
// lifecycle against a real Postgres (CI provisions one; see ci.yml's `e2e` job).
describe('Auth (e2e)', () => {
  let app: INestApplication;
  const unique = Date.now();
  const adminEmail = `admin+${unique}@acme.co.ke`;
  const password = 'Password123!';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('signs up a new tenant + admin user and returns tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        tenantName: `Acme ${unique}`,
        countryCode: 'KE',
        adminEmail,
        adminPassword: password,
      })
      .expect(201);

    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
    expect(res.body.user.email).toBe(adminEmail);
  });

  it('rejects signup with a duplicate email', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        tenantName: 'Another Co',
        countryCode: 'KE',
        adminEmail,
        adminPassword: password,
      })
      .expect(409);
  });

  it('logs in with valid credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, password })
      .expect(200);

    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
  });

  it('rejects login with a wrong password', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, password: 'WrongPassword!' })
      .expect(401);
  });

  it('refreshes tokens with a valid refresh token, then rejects reuse of the logged-out session', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, password })
      .expect(200);
    const refreshToken: string = loginRes.body.refreshToken;

    const refreshRes = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Authorization', `Bearer ${refreshToken}`)
      .expect(200);
    expect(refreshRes.body.accessToken).toEqual(expect.any(String));
    const newAccessToken: string = refreshRes.body.accessToken;

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${newAccessToken}`)
      .expect(204);

    // The refresh token's hash was cleared by logout, so reusing the
    // now-stale (already-rotated) refresh token must fail.
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Authorization', `Bearer ${refreshToken}`)
      .expect(401);
  });
});
