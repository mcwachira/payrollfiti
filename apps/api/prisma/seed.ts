import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  await prisma.plan.upsert({
    where: { code: 'starter' },
    create: { code: 'starter', name: 'Starter', pricePerEmployee: 5, currency: 'USD', tier: 'starter' },
    update: {},
  });
  await prisma.plan.upsert({
    where: { code: 'growth' },
    create: { code: 'growth', name: 'Growth', pricePerEmployee: 8, currency: 'USD', tier: 'growth' },
    update: {},
  });

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
