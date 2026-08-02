import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { describe, it, beforeAll, afterAll, expect } from '@jest/globals';
import request from 'supertest';
import { AppModule } from './../src/app.module';

// Smoke-tests the payroll lifecycle: run -> idempotent re-run -> payslip
// download -> bank export download. Requires a real Postgres (CI provisions
// one; see ci.yml's `e2e` job).
describe('Payroll (e2e)', () => {
  let app: INestApplication;
  const unique = Date.now();

  let accessToken: string;
  let companyId: string;
  let payrollRunId: string;
  let payrollEntryId: string;

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

    const signup = await request(http)
      .post('/auth/signup')
      .send({
        tenantName: `Payroll Co ${unique}`,
        countryCode: 'KE',
        adminEmail: `payroll-admin+${unique}@acme.co.ke`,
        adminPassword: 'Password123!',
      })
      .expect(201);
    accessToken = signup.body.accessToken;

    const company = await request(http)
      .post('/tenants/companies')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: `Payroll HQ ${unique}`, currency: 'KES' })
      .expect(201);
    companyId = company.body.id;

    const employee = await request(http)
      .post('/employees')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        companyId,
        firstName: 'Peter',
        lastName: 'Kamau',
        email: `peter.kamau+${unique}@acme.co.ke`,
      })
      .expect(201);

    await request(http)
      .post(`/employees/${employee.body.id}/salary-structures`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        basicSalary: 80000,
        allowances: { transport: 5000 },
        currency: 'KES',
        effectiveFrom: '2026-01-01',
      })
      .expect(201);

    // New employees start in ONBOARDING and are excluded from payroll runs
    // until onboarding completes — clear every seeded checklist task first.
    const tasks = await request(http)
      .get(`/employees/${employee.body.id}/onboarding-tasks`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    for (const task of tasks.body) {
      await request(http)
        .patch(`/employees/${employee.body.id}/onboarding-tasks/${task.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ completed: true })
        .expect(200);
    }
    await request(http)
      .post(`/employees/${employee.body.id}/onboarding/complete`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  const runDto = {
    period: '2026-07',
    periodStart: '2026-07-01',
    periodEnd: '2026-07-31',
  };

  it('runs payroll for the company', async () => {
    const res = await request(app.getHttpServer())
      .post('/payroll-runs')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ companyId, ...runDto })
      .expect(201);

    expect(res.body.id).toEqual(expect.any(String));
    expect(res.body.entries.length).toBeGreaterThan(0);
    payrollRunId = res.body.id;
    payrollEntryId = res.body.entries[0].id;
  });

  it('is idempotent: an identical re-run returns the same run', async () => {
    const res = await request(app.getHttpServer())
      .post('/payroll-runs')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ companyId, ...runDto })
      .expect(201);

    expect(res.body.id).toBe(payrollRunId);
  });

  it('downloads the payslip PDF for an entry', async () => {
    const res = await request(app.getHttpServer())
      .get(`/payslips/${payrollEntryId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.headers['content-type']).toContain('application/pdf');
  });

  it('downloads the bank export CSV for the run', async () => {
    const res = await request(app.getHttpServer())
      .get(`/payroll-runs/${payrollRunId}/bank-export`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('employee_number');
  });
});
