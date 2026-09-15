# Payroll Engine

## Architecture

The payroll engine is organized as a deterministic calculation pipeline with tenant-aware execution and a domain-level rule registry.

Payroll Request
      ↓
Payroll Command
      ↓
Payroll Engine
      ↓
Country Rules
      ↓
Calculation
      ↓
Payroll Entry

## Calculation flow

The implemented flow mirrors the current domain architecture in the repository:

1. A payroll calculation request is received by the API controller or command layer.
2. The request is validated and mapped into a deterministic input object.
3. The system resolves the correct country rule set for the active tenant and employee context.
4. The engine computes earnings, taxable pay, statutory deductions, and employee deductions.
5. The net amount and supporting metadata are assembled into a payroll result.
6. The payroll run is persisted using tenant-scoped entry records.
7. Idempotent request handling prevents a second execution from creating a duplicate authoritative payroll result.

## Rules

The current implementation supports a country-rule registry with the following rule sets:

- Kenya
- Nigeria
- South Africa

The engine is intentionally organized so that additional countries can be added without rewriting the primary calculation flow.

## Rounding

The project is expected to remain decimal-safe, but the current implementation should be treated as a baseline rather than a fully hardened financial-grade rounding model. Financial values should be computed using integer cents or decimal-safe arithmetic before any final serialization.

Current operational guidance:
- Do not use raw PHP float arithmetic for authoritative payroll financial calculations.
- Centralize rounding at the calculation boundary and resolve all downstream comparisons against that value.
- Ensure each payroll result is reproducible and deterministic for a specific input set.

## Country support

### Kenya
Status: IMPLEMENTED

- Rule registry entry exists.
- Calculation pipeline resolves the country rule set for Kenya-based employees.

### Nigeria
Status: IMPLEMENTED

- Rule registry entry exists.
- Calculation pipeline resolves the country rule set for Nigeria-based employees.

### South Africa
Status: IMPLEMENTED

- Rule registry entry exists.
- Calculation pipeline resolves the country rule set for South Africa-based employees.

## Example

The following is a fictional example only and does not use real employee data.

Example payroll scenario:
- Employee: Example Employee A
- Country: Kenya
- Gross pay: 120,000.00
- Deduction A: 5,000.00
- Deduction B: 2,500.00
- Net pay: 112,500.00

The engine should be able to reproduce the same result if the same tenant, employee, period, and inputs are supplied again.

## Idempotency

Payroll execution uses a deterministic input hash to prevent duplicate calculation results.

This protects against:
- double-clicks in the UI
- repeated API calls with the same payload
- queue retry duplication
- accidental re-submission of the same payroll run

## Concurrency and safety

The engine is expected to rely on tenant-scoped state transitions and database-level protections for critical payroll operations.

The following checks are relevant:
- tenant isolation at the model and policy layer
- unique run identity or input hash guard
- state transitions that reject invalid lifecycle changes
- safe enqueueing and worker execution with tenant context cleanup

## Security and observability

The payroll engine must avoid exposing sensitive employee data in logs and should only emit safe identifiers such as tenant ID, payroll run ID, or job ID in operational logs.

The current implementation is structured to support this model, but a full observability and audit pass is still required before calling it fully production-ready.

## Known limitations

- Full statutory tax logic is still being validated against real-world payroll scenarios.
- Additional lifecycle checks for approval and finalization remain incomplete.
- Queue-level safeguards and audit trail coverage should be expanded before broad production use.
- The system should continue to be tested under cross-tenant and retry scenarios before final production sign-off.
