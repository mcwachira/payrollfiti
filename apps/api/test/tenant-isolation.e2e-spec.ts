import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { describe, it, beforeAll, afterAll, expect } from '@jest/globals';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TenantContext } from '../src/common/tenant/tenant-context';

/**
 * Proves the ORM-level guarantee added on top of the existing manual
 * tenantId checks: even a query that forgets to filter by tenantId is
 * still scoped to the caller's tenant for models carrying a direct
 * tenantId column (see tenant-scoping.extension.ts). Exercises
 * PrismaService directly against a real database — bypassing service-layer
 * filtering entirely — so this fails if the extension itself regresses,
 * independent of whether any individual service remembers to filter.
 *
 * Every call below runs inside `TenantContext.run({tenantId}, async () => {
 * await prisma...() })` — matching how every real service in this codebase
 * calls Prisma (always awaited, never a bare returned promise) — because
 * Prisma's create/update/etc. calls return lazy "thenables" that don't
 * actually dispatch until awaited/`.then()`'d, and AsyncLocalStorage only
 * stays active for `run()`'s synchronous callback frame. See
 * TenantContextInterceptor for how the same hazard is handled for the
 * actual HTTP request path (it isn't just a testing footgun — an
 * interceptor that did `TenantContext.run(store, () => next.handle())`
 * without subscribing internally would suffer the identical bug, since
 * `next.handle()` returns an equally lazy Observable).
 */
describe('Tenant isolation at the ORM layer (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const unique = Date.now();

  let tenantAId: string;
  let tenantBId: string;

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
    prisma = app.get(PrismaService);

    const http = app.getHttpServer();

    const tenantASignup = await request(http)
      .post('/auth/signup')
      .send({
        tenantName: `Isolation Tenant A ${unique}`,
        countryCode: 'KE',
        adminEmail: `iso-admin-a+${unique}@acme.co.ke`,
        adminPassword: 'Password123!',
      })
      .expect(201);
    tenantAId = tenantASignup.body.user.tenantId;

    const tenantBSignup = await request(http)
      .post('/auth/signup')
      .send({
        tenantName: `Isolation Tenant B ${unique}`,
        countryCode: 'KE',
        adminEmail: `iso-admin-b+${unique}@acme.co.ke`,
        adminPassword: 'Password123!',
      })
      .expect(201);
    tenantBId = tenantBSignup.body.user.tenantId;
  });

  afterAll(async () => {
    await app.close();
  });

  it('scopes a naive findMany (no tenantId in the where clause) to the caller tenant', async () => {
    await TenantContext.run({ tenantId: tenantAId }, async () => {
      await prisma.salaryComponent.create({
        data: {
          name: 'Tenant A Allowance',
          code: `TENANT_A_ALLOWANCE_${unique}`,
          type: 'EARNING',
        } as never,
      });
    });
    await TenantContext.run({ tenantId: tenantBId }, async () => {
      await prisma.salaryComponent.create({
        data: {
          name: 'Tenant B Allowance',
          code: `TENANT_B_ALLOWANCE_${unique}`,
          type: 'EARNING',
        } as never,
      });
    });

    const seenByTenantA = await TenantContext.run(
      { tenantId: tenantAId },
      async () => prisma.salaryComponent.findMany({}),
    );
    expect(seenByTenantA.map((c) => c.name)).toContain('Tenant A Allowance');
    expect(seenByTenantA.map((c) => c.name)).not.toContain(
      'Tenant B Allowance',
    );

    const seenByTenantB = await TenantContext.run(
      { tenantId: tenantBId },
      async () => prisma.salaryComponent.findMany({}),
    );
    expect(seenByTenantB.map((c) => c.name)).toContain('Tenant B Allowance');
    expect(seenByTenantB.map((c) => c.name)).not.toContain(
      'Tenant A Allowance',
    );
  });

  it('cannot fetch another tenant row by id even when the id is known', async () => {
    const created = await TenantContext.run(
      { tenantId: tenantAId },
      async () =>
        prisma.salaryComponent.create({
          data: {
            name: 'Direct Lookup Target',
            code: `DIRECT_LOOKUP_${unique}`,
            type: 'EARNING',
          } as never,
        }),
    );

    const fromOwnTenant = await TenantContext.run(
      { tenantId: tenantAId },
      async () => prisma.salaryComponent.findUnique({ where: { id: created.id } }),
    );
    expect(fromOwnTenant?.id).toBe(created.id);

    const fromOtherTenant = await TenantContext.run(
      { tenantId: tenantBId },
      async () => prisma.salaryComponent.findUnique({ where: { id: created.id } }),
    );
    expect(fromOtherTenant).toBeNull();
  });

  it('auto-fills tenantId on create and rejects a spoofed tenantId', async () => {
    const created = await TenantContext.run(
      { tenantId: tenantAId },
      async () =>
        prisma.salaryComponent.create({
          data: {
            name: 'Auto-filled Component',
            code: `AUTO_FILL_${unique}`,
            type: 'EARNING',
          } as never,
        }),
    );
    expect(created.tenantId).toBe(tenantAId);

    await expect(
      TenantContext.run({ tenantId: tenantAId }, async () =>
        prisma.salaryComponent.create({
          data: {
            name: 'Spoofed Component',
            code: `SPOOFED_${unique}`,
            type: 'EARNING',
            tenantId: tenantBId,
          } as never,
        }),
      ),
    ).rejects.toThrow();
  });

  it('does not enforce tenant scoping outside a tenant context (system/background paths)', async () => {
    const all = await prisma.salaryComponent.findMany({
      where: {
        code: {
          in: [`TENANT_A_ALLOWANCE_${unique}`, `TENANT_B_ALLOWANCE_${unique}`],
        },
      },
    });
    expect(all.length).toBe(2);
  });
});
