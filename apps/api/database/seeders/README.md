# PayrollFiti development seed data

**DEVELOPMENT ONLY — DO NOT USE THESE CREDENTIALS IN PRODUCTION.**

Run from `apps/api`:

```bash
php artisan migrate:fresh --seed
php artisan db:seed
```

The seed is deterministic and uses stable UUIDs, slugs, codes, emails, and provider references. Re-running `db:seed` updates the same logical records instead of creating duplicates.

## Tenants and companies

| Tenant | Company | Country |
| --- | --- | --- |
| `imara-foods` | Imara Foods Kenya Ltd | Kenya |
| `savanna-logistics` | Savanna Logistics Uganda Ltd | Uganda |

Each tenant has one company, ten employees, payroll periods/runs, leave, loans, attendance, documents, billing, notification, webhook, API-key, accounting, audit, idempotency, outbox, report, and export records.

## Demo users

All demo users use the development password `PayrollFitiDemo!2026`.

| Email pattern | Role |
| --- | --- |
| `admin@kenya.payrollfiti.test` / `admin@uganda.payrollfiti.test` | Tenant Admin |
| `payroll@kenya.payrollfiti.test` / `payroll@uganda.payrollfiti.test` | Payroll Manager |
| `hr@kenya.payrollfiti.test` / `hr@uganda.payrollfiti.test` | HR Manager |

The API key, webhook, payment, and accounting values are development fixtures only. No real provider is contacted, and document/payslip paths point to local fixture paths without uploading binary files.

Contracts are described by the PDFs but are not present in the current repository schema, so no fabricated contract records are seeded. The same applies to model-backed policies/services/enums: the repository currently contains only the `User` model and no domain implementations.
