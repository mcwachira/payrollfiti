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

  describe('terminate', () => {
    it('terminates an employee, closes their contract, and revokes their portal access', async () => {
      const contract = await request(app.getHttpServer())
        .post(`/employees/${tenantAEmployeeId}/contracts`)
        .set('Authorization', `Bearer ${tenantAAccessToken}`)
        .send({ type: 'PERMANENT', startDate: '2026-01-01' })
        .expect(201);
      expect(contract.body.endDate).toBeNull();

      const res = await request(app.getHttpServer())
        .post(`/employees/${tenantAEmployeeId}/terminate`)
        .set('Authorization', `Bearer ${tenantAAccessToken}`)
        .send({ terminationDate: '2026-07-15', reason: 'Resignation' })
        .expect(201);

      expect(res.body.status).toBe('TERMINATED');
      expect(res.body.terminationReason).toBe('Resignation');

      const fetched = await request(app.getHttpServer())
        .get(`/employees/${tenantAEmployeeId}`)
        .set('Authorization', `Bearer ${tenantAAccessToken}`)
        .expect(200);
      expect(fetched.body.status).toBe('TERMINATED');
    });

    it('rejects terminating the same employee twice', async () => {
      await request(app.getHttpServer())
        .post(`/employees/${tenantAEmployeeId}/terminate`)
        .set('Authorization', `Bearer ${tenantAAccessToken}`)
        .send({})
        .expect(400);
    });

    it('returns 404 when a different tenant tries to terminate this employee', async () => {
      const res = await request(app.getHttpServer())
        .post('/employees')
        .set('Authorization', `Bearer ${tenantAAccessToken}`)
        .send({
          companyId: tenantACompanyId,
          firstName: 'Other',
          lastName: 'Employee',
          email: `other.employee+${unique}@acme.co.ke`,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/employees/${res.body.id}/terminate`)
        .set('Authorization', `Bearer ${tenantBAccessToken}`)
        .send({})
        .expect(404);
    });
  });

  describe('onboarding', () => {
    let onboardingEmployeeId: string;

    it('creates a new employee in ONBOARDING status with a seeded checklist', async () => {
      const res = await request(app.getHttpServer())
        .post('/employees')
        .set('Authorization', `Bearer ${tenantAAccessToken}`)
        .send({
          companyId: tenantACompanyId,
          firstName: 'New',
          lastName: 'Hire',
          email: `new.hire+${unique}@acme.co.ke`,
        })
        .expect(201);
      expect(res.body.status).toBe('ONBOARDING');
      onboardingEmployeeId = res.body.id;

      const tasks = await request(app.getHttpServer())
        .get(`/employees/${onboardingEmployeeId}/onboarding-tasks`)
        .set('Authorization', `Bearer ${tenantAAccessToken}`)
        .expect(200);
      expect(tasks.body.length).toBeGreaterThan(0);
      expect(
        tasks.body.some((t: any) => t.title === 'KRA PIN collected'),
      ).toBe(true);
    });

    it('refuses to complete onboarding while required tasks are incomplete', async () => {
      await request(app.getHttpServer())
        .post(`/employees/${onboardingEmployeeId}/onboarding/complete`)
        .set('Authorization', `Bearer ${tenantAAccessToken}`)
        .expect(400);
    });

    it('activates the employee once all required tasks are completed', async () => {
      const tasks = await request(app.getHttpServer())
        .get(`/employees/${onboardingEmployeeId}/onboarding-tasks`)
        .set('Authorization', `Bearer ${tenantAAccessToken}`)
        .expect(200);

      for (const task of tasks.body.filter((t: any) => t.isRequired)) {
        await request(app.getHttpServer())
          .patch(
            `/employees/${onboardingEmployeeId}/onboarding-tasks/${task.id}`,
          )
          .set('Authorization', `Bearer ${tenantAAccessToken}`)
          .send({ completed: true })
          .expect(200);
      }

      const res = await request(app.getHttpServer())
        .post(`/employees/${onboardingEmployeeId}/onboarding/complete`)
        .set('Authorization', `Bearer ${tenantAAccessToken}`)
        .expect(201);
      expect(res.body.status).toBe('ACTIVE');
    });
  });
});
