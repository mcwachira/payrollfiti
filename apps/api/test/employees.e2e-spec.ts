import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { describe, it, beforeAll, afterAll, expect } from '@jest/globals';
import request from 'supertest';
import { AppModule } from './../src/app.module';

// Smoke-tests employee CRUD plus the critical cross-tenant isolation
// guarantee. Requires a real Postgres (CI provisions one; see ci.yml).
describe('Employees (e2e)', () => {
  let app: INestApplication;
  const unique = Date.now();

  let tenantAAccessToken: string;
  let tenantACompanyId: string;
  let tenantAEmployeeId: string;
  let tenantBAccessToken: string;

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

    const http = app.getHttpServer();

    const tenantASignup = await request(http)
      .post('/auth/signup')
      .send({
        tenantName: `Tenant A ${unique}`,
        countryCode: 'KE',
        adminEmail: `admin-a+${unique}@acme.co.ke`,
        adminPassword: 'Password123!',
      })
      .expect(201);
    tenantAAccessToken = tenantASignup.body.accessToken;

    const tenantBSignup = await request(http)
      .post('/auth/signup')
      .send({
        tenantName: `Tenant B ${unique}`,
        countryCode: 'KE',
        adminEmail: `admin-b+${unique}@acme.co.ke`,
        adminPassword: 'Password123!',
      })
      .expect(201);
    tenantBAccessToken = tenantBSignup.body.accessToken;

    const company = await request(http)
      .post('/tenants/companies')
      .set('Authorization', `Bearer ${tenantAAccessToken}`)
      .send({ name: `Acme HQ ${unique}`, currency: 'KES' })
      .expect(201);
    tenantACompanyId = company.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates an employee under the admin tenant', async () => {
    const res = await request(app.getHttpServer())
      .post('/employees')
      .set('Authorization', `Bearer ${tenantAAccessToken}`)
      .send({
        companyId: tenantACompanyId,
        firstName: 'Jane',
        lastName: 'Doe',
        email: `jane.doe+${unique}@acme.co.ke`,
      })
      .expect(201);

    expect(res.body.id).toEqual(expect.any(String));
    tenantAEmployeeId = res.body.id;
  });

  it('lists employees for the company', async () => {
    const res = await request(app.getHttpServer())
      .get('/employees')
      .query({ companyId: tenantACompanyId })
      .set('Authorization', `Bearer ${tenantAAccessToken}`)
      .expect(200);

    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: tenantAEmployeeId }),
      ]),
    );
  });

  it('gets the employee by id', async () => {
    const res = await request(app.getHttpServer())
      .get(`/employees/${tenantAEmployeeId}`)
      .set('Authorization', `Bearer ${tenantAAccessToken}`)
      .expect(200);

    expect(res.body.id).toBe(tenantAEmployeeId);
  });

  it('returns 404 when a different tenant requests this employee id (cross-tenant isolation)', async () => {
    await request(app.getHttpServer())
      .get(`/employees/${tenantAEmployeeId}`)
      .set('Authorization', `Bearer ${tenantBAccessToken}`)
      .expect(404);
  });
});
