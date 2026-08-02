import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { getPricingForCountry, getSupportedPricingCountries } from '@repo/pricing';

const prisma = new PrismaClient();

// Legacy global USD plans predate per-country pricing and are ambiguous about
// which currency a tenant would actually be charged in. Deactivate rather
// than delete so any pre-existing Subscription rows that still reference
// them by planId keep resolving.
async function deactivateLegacyPlans() {
  for (const code of ['starter', 'growth']) {
    await prisma.plan.updateMany({
      where: { code },
      data: { isActive: false },
    });
  }
}

// Seed one billable Plan per (supported country x self-serve tier), priced
// from the same @repo/pricing catalog the marketing site reads from, so the
// price a tenant sees on the pricing page is the price they're actually
// billed. Enterprise is excluded — it's "contact sales", not self-serve.
async function seedCountryPlans() {
  for (const countryCode of getSupportedPricingCountries()) {
    const pricing = getPricingForCountry(countryCode);
    for (const tier of pricing.tiers) {
      if (tier.price === null) continue;
      const code = `${countryCode.toLowerCase()}-${tier.code}`;
      await prisma.plan.upsert({
        where: { code },
        create: {
          code,
          name: `${tier.name} (${countryCode})`,
          pricePerEmployee: tier.price,
          currency: pricing.currency,
          tier: tier.code,
          countryCode,
        },
        update: {
          name: `${tier.name} (${countryCode})`,
          pricePerEmployee: tier.price,
          currency: pricing.currency,
          isActive: true,
        },
      });
    }
  }
}

async function main() {
  await deactivateLegacyPlans();
  await seedCountryPlans();

  const tenant = await prisma.tenant.upsert({
    where: { id: 'demo-tenant' },
    create: { id: 'demo-tenant', name: 'Acme Kenya Ltd', countryCode: 'KE', defaultCurrency: 'KES' },
    update: {},
  });

  const passwordHash = await bcrypt.hash('Password123!', 12);
  await prisma.user.upsert({
    where: { email: 'admin@acme.co.ke' },
    create: { tenantId: tenant.id, email: 'admin@acme.co.ke', passwordHash, role: Role.ADMIN },
    update: {},
  });

  const company = await prisma.company.upsert({
    where: { id: 'demo-company' },
    create: { id: 'demo-company', tenantId: tenant.id, name: 'Acme Kenya Ltd HQ', currency: 'KES' },
    update: {},
  });

  const employee = await prisma.employee.upsert({
    where: { email: 'jane.wanjiru@acme.co.ke' },
    create: {
      companyId: company.id,
      employeeNumber: 'EMP001',
      firstName: 'Jane',
      lastName: 'Wanjiru',
      email: 'jane.wanjiru@acme.co.ke',
      jobRole: 'Software Engineer',
      currency: 'KES',
      bankName: 'Equity Bank',
      bankAccountNumber: '1234567890',
      bankCode: '068',
      bankBranchCode: '068001',
    },
    update: {},
  });

  await prisma.salaryStructure.upsert({
    where: { id: 'demo-salary-structure' },
    create: {
      id: 'demo-salary-structure',
      employeeId: employee.id,
      basicSalary: 120_000,
      allowances: { transport: 10_000, housing: 20_000 },
      currency: 'KES',
      effectiveFrom: new Date('2024-01-01'),
    },
    update: {},
  });

  const employeeUserPasswordHash = await bcrypt.hash('Password123!', 12);
  await prisma.user.upsert({
    where: { email: 'jane.wanjiru@acme.co.ke' },
    create: {
      tenantId: tenant.id,
      email: 'jane.wanjiru@acme.co.ke',
      passwordHash: employeeUserPasswordHash,
      role: Role.EMPLOYEE,
      employeeId: employee.id,
    },
    update: {},
  });

  console.log('Seed complete:');
  console.log('  Admin login:    admin@acme.co.ke / Password123!');
  console.log('  Employee login: jane.wanjiru@acme.co.ke / Password123!');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
