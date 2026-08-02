# Part 9 — HR Features

## 9.1 Leave Management

**Lazy, on-read accrual — no cron job.** Rather than a nightly job that increments every employee's leave balance, `getOrCreateBalance` recomputes `accruedDays` deterministically every time it's called, from first principles: whole calendar months elapsed since the later of "Jan 1 of the year" or "the employee's earliest contract start date," pro-rated against the leave type's annual entitlement.

```typescript
// leave/leave.service.ts
function wholeMonthsBetween(start: Date, end: Date): number {
  if (end <= start) return 0;
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

async getOrCreateBalance(tenantId: string, employeeId: string, leaveTypeId: string, year: number) {
  const leaveType = await this.prisma.leaveType.findUnique({ where: { id: leaveTypeId } });
  const earliestContract = await this.prisma.contract.findFirst({ where: { employeeId }, orderBy: { startDate: 'asc' } });

  const jan1 = new Date(Date.UTC(year, 0, 1));
  // Exclusive upper bound (Jan 1 of the FOLLOWING year), not Dec 31 — "whole
  // calendar months" from Jan 1 to Dec 31 is only 11 months (one day short
  // of a full 12th), which would make a fully-elapsed year permanently
  // under-accrue by one month's worth of leave.
  const yearEndExclusive = new Date(Date.UTC(year + 1, 0, 1));
  const today = new Date();

  const periodStart = earliestContract && earliestContract.startDate > jan1 ? earliestContract.startDate : jan1;
  const periodEnd = today < yearEndExclusive ? today : yearEndExclusive;
  const monthsElapsed = wholeMonthsBetween(periodStart, periodEnd);
  const accruedDays = Math.min(leaveType.daysPerYear, (monthsElapsed * leaveType.daysPerYear) / 12);

  return this.prisma.leaveBalance.upsert({
    where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
    create: { employeeId, leaveTypeId, year, accruedDays, usedDays: 0 },
    update: { accruedDays }, // usedDays is untouched here — only a decision changes it
  });
}
```

Recomputing and upserting on every call keeps `accruedDays` monotonic and idempotent regardless of how many times it's read in a given month. `usedDays` is deliberately left untouched by this method — it only changes when a leave request is actually approved (below). Deliberate scope cuts, called out explicitly rather than left implicit: no annual-upfront-grant alternative, no year-to-year carry-over, no nightly accrual job.

**Requesting leave** deducts public holidays (Part 9.3) from the requested date range, then checks the balance computed above:

```typescript
async createLeaveRequest(tenantId: string, employeeId: string, dto: CreateLeaveRequestDto) {
  const leaveType = await this.prisma.leaveType.findUnique({ where: { id: dto.leaveTypeId } });
  const startDate = new Date(dto.startDate), endDate = new Date(dto.endDate);
  if (endDate < startDate) throw new BadRequestException('endDate cannot be before startDate');

  // Calendar days inclusive, minus public holidays for the tenant's country.
  // Simplification, stated explicitly: weekends are still not excluded.
  const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  const calendarDays = Math.round((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1;
  const holidaysInRange = this.holidaysService.countHolidaysInRange(tenant.countryCode, startDate, endDate);
  const daysRequested = Math.max(0, calendarDays - holidaysInRange);

  if (leaveType.isPaid) {
    const balance = await this.getOrCreateBalance(tenantId, employeeId, leaveType.id, startDate.getFullYear());
    if (balance.accruedDays - balance.usedDays < daysRequested) {
      throw new BadRequestException('Insufficient leave balance');
    }
  }

  const request = await this.prisma.leaveRequest.create({
    data: { employeeId, leaveTypeId: leaveType.id, startDate, endDate, daysRequested, reason: dto.reason, status: 'PENDING' },
  });
  await this.notificationsService.createForRoles(tenantId, [Role.ADMIN, Role.HR], 'LEAVE_REQUEST_PENDING', `...`, { leaveRequestId: request.id });
  return request;
}
```

**Approval** increments `usedDays` on the balance row created above, and notifies the employee's linked `User` (if they have portal access):

```typescript
async decide(tenantId: string, approverId: string, requestId: string, decision: 'APPROVED' | 'REJECTED') {
  const request = await this.prisma.leaveRequest.findUnique({ where: { id: requestId }, include: { employee: { include: { company: true, user: true } }, leaveType: true } });
  if (!request || request.employee.company.tenantId !== tenantId) throw new NotFoundException('Leave request not found');
  if (request.status !== 'PENDING') throw new BadRequestException('Leave request has already been decided');

  const updated = await this.prisma.leaveRequest.update({ where: { id: requestId }, data: { status: decision, approverId, decidedAt: new Date() } });

  if (decision === 'APPROVED' && request.leaveType.isPaid) {
    // Guaranteed to exist — createLeaveRequest already called
    // getOrCreateBalance for this exact employee/leaveType/year.
    await this.prisma.leaveBalance.update({
      where: { employeeId_leaveTypeId_year: { employeeId: request.employeeId, leaveTypeId: request.leaveTypeId, year: request.startDate.getFullYear() } },
      data: { usedDays: { increment: request.daysRequested } },
    });
  }
  if (request.employee.user) {
    await this.notificationsService.create(tenantId, request.employee.user.id, 'LEAVE_REQUEST_DECIDED', `Your leave request has been ${decision.toLowerCase()}.`, { leaveRequestId: request.id, decision });
  }
  return updated;
}
```

## 9.2 Loans & Advances

**A rejected loan never touches the payroll pipeline** — the repayment schedule (`LoanRepayment` rows) is only generated the moment a loan is *approved*, computed as an even split of `principal` across `installments`, with rounding remainder absorbed into the final installment so the schedule always sums to exactly `principal`:

```typescript
// loans/loans.service.ts
async decide(tenantId: string, actorId: string, loanId: string, dto: DecideLoanDto) {
  const loan = await this.findLoanOrThrow(tenantId, loanId);
  if (loan.status !== 'PENDING') throw new BadRequestException('Only pending loans can be approved or rejected');

  if (dto.decision === 'REJECTED') {
    const updated = await this.prisma.loan.update({ where: { id: loanId }, data: { status: 'REJECTED', approvedById: actorId, decidedAt: new Date(), closedAt: new Date() } });
    await this.notifyEmployee(tenantId, loan.employeeId, 'LOAN_REJECTED', `Your loan request has been rejected...`, { loanId });
    return updated;
  }

  const installmentAmount = round2(loan.principal / loan.installments);
  const repaymentsData = Array.from({ length: loan.installments }, (_, i) => {
    const isLast = i === loan.installments - 1;
    // Last installment absorbs the rounding remainder so the schedule sums
    // exactly to principal, never a cent over or under due to round2().
    const amountDue = isLast ? round2(loan.principal - installmentAmount * (loan.installments - 1)) : installmentAmount;
    return { loanId, installmentNo: i + 1, period: addMonthsToPeriod(loan.startPeriod, i), amountDue };
  });

  const updated = await this.prisma.$transaction(async (tx) => {
    await tx.loanRepayment.createMany({ data: repaymentsData });
    return tx.loan.update({ where: { id: loanId }, data: { status: 'ACTIVE', installmentAmount, approvedById: actorId, decidedAt: new Date() } });
  });
  await this.notifyEmployee(tenantId, loan.employeeId, 'LOAN_APPROVED', `Your loan of ${loan.currency} ${loan.principal} has been approved...`, { loanId });
  return updated;
}
```

**The payroll integration point** — this is the function `PayrollService.executeRun` calls per-employee (Part 5 §5.2) before the pure engine even runs, folding any installment due *this period* into the same `deductions.voluntary` map salary components use:

```typescript
async resolvePayrollDeductions(tenantId: string, employeeId: string, period: string): Promise<{ voluntaryDeductions: Record<string, number>; repayments: DueLoanRepayment[] }> {
  const due = await this.prisma.loanRepayment.findMany({
    where: { period, status: 'PENDING', loan: { employeeId, tenantId, status: 'ACTIVE' } },
  });
  const voluntaryDeductions: Record<string, number> = {};
  for (const repayment of due) {
    // Keyed per loan so multiple concurrent loans stay distinguishable on the payslip.
    voluntaryDeductions[`LOAN_REPAYMENT_${repayment.loanId}`] = repayment.amountDue;
  }
  return { voluntaryDeductions, repayments: due.map((r) => ({ id: r.id, loanId: r.loanId, amountDue: r.amountDue })) };
}
```

Then, once the run has *already committed*, `markRepaymentsPaid` closes the loop — and, like the webhook side-effects in Part 7, it never throws, because a notification/bookkeeping failure here must not retroactively fail an already-committed payroll run:

```typescript
async markRepaymentsPaid(repayments: DueLoanRepayment[], payrollEntryId: string): Promise<void> {
  const affectedLoanIds = new Set<string>();
  try {
    for (const repayment of repayments) {
      await this.prisma.loanRepayment.update({ where: { id: repayment.id }, data: { status: 'PAID', amountPaid: repayment.amountDue, paidAt: new Date(), payrollEntryId } });
      affectedLoanIds.add(repayment.loanId);
    }
  } catch (error) {
    this.logger.error('Failed to mark loan repayments paid', error as Error);
    return; // worst case, reconciled manually later
  }
  for (const loanId of affectedLoanIds) await this.closeIfFullyRepaid(loanId); // auto-transitions to PAID_OFF once every installment clears
}
```

**Early payoff** is the mirror image: remaining `PENDING` installments are marked `SKIPPED`, never `PAID` — because the balance was settled outside payroll (e.g. cash), and `PAID` would falsely imply it came out of a payslip.

## 9.3 Public Holidays

A small, pure lookup service — country-and-year holiday definitions come from a static table (`holiday-definitions.ts`), not an external API, so it works fully offline and deterministically:

```typescript
// holidays/holidays.service.ts
@Injectable()
export class HolidaysService {
  listForCountry(countryCode: string, year: number): HolidayDefinition[] {
    return getHolidayDefinitions(countryCode, year).sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  isHoliday(countryCode: string, date: Date): boolean {
    return getHolidayDefinitions(countryCode, date.getUTCFullYear()).some((h) => isSameUtcDate(h.date, date));
  }

  /** Count of public holidays falling within [start, end], inclusive, spanning any number of years. */
  countHolidaysInRange(countryCode: string, start: Date, end: Date): number {
    let count = 0;
    for (let year = start.getUTCFullYear(); year <= end.getUTCFullYear(); year++) {
      for (const holiday of getHolidayDefinitions(countryCode, year)) {
        if (holiday.date >= start && holiday.date <= end) count++;
      }
    }
    return count;
  }
}
```

`countHolidaysInRange` is the direct dependency Leave Management uses (§9.1) to avoid charging an employee's balance for a public holiday that happens to fall inside their requested date range. Looping year-by-year (rather than assuming a request never crosses a year boundary) is what makes a leave request spanning, say, late December into early January still count both years' holiday tables correctly.

## 9.4 Attendance

`AttendanceRecord` (Part 2 §2.3 Cluster 5) is a simple one-row-per-employee-per-day model — `@@unique([employeeId, date])` enforces that a given day can only have one status (`PRESENT`/`ABSENT`/`LEAVE`) recorded for a given employee, so re-marking the same day is an upsert, not a duplicate insert. `AttendanceService` is a thin CRUD layer with the same tenant-ownership check pattern as every other module (`findOne` → verify `employee.company.tenantId === tenantId` before allowing read/write) and a `@Roles(Role.ADMIN, Role.HR)` + `@RequirePermission(Permission.ATTENDANCE_MANAGE)` gate on writes. Attendance is currently a standalone HR record — it does not yet feed into payroll proration (Part 3 §3.4's engine-level proration is driven by employment start/end dates, not day-by-day attendance).

## 9.5 Employee Documents

Documents (contracts, ID scans, certificates) are stored on local disk under `DOCUMENT_STORAGE_DIR`, one subdirectory per employee, with a UUID-prefixed filename to avoid collisions — the DB row is the source of truth for metadata, the filesystem just holds bytes:

```typescript
// documents/documents.service.ts
async upload(tenantId: string, employeeId: string, actor: AuthenticatedRequestUser, file: Express.Multer.File, type: string) {
  await this.assertAccess(tenantId, employeeId, actor); // EMPLOYEE role may only touch their own; ADMIN/HR unrestricted within tenant

  const employeeDir = join(STORAGE_DIR, employeeId);
  await mkdir(employeeDir, { recursive: true });
  const fileName = `${randomUUID()}-${file.originalname}`;
  await writeFile(join(employeeDir, fileName), file.buffer);

  return this.prisma.document.create({
    data: { employeeId, type, fileName: file.originalname, mimeType: file.mimetype, sizeBytes: file.size, url: join(employeeId, fileName), uploadedById: actor.id },
  });
}

private async assertAccess(tenantId: string, employeeId: string, actor: AuthenticatedRequestUser) {
  await this.employeesService.findOne(tenantId, employeeId); // throws NotFoundException on cross-tenant/unknown employee
  if (actor.role === Role.EMPLOYEE && actor.employeeId !== employeeId) {
    throw new ForbiddenException('You may only access your own documents');
  }
}
```

Deletion mirrors the DB-then-disk order deliberately: the `Document` row is deleted first, then the file is unlinked in a best-effort try/catch — a missing file on disk (already cleaned up some other way) must never block removing the metadata row that a user explicitly asked to delete:

```typescript
async remove(tenantId: string, documentId: string, actor: AuthenticatedRequestUser) {
  const document = await this.findOne(tenantId, documentId, actor);
  await this.prisma.document.delete({ where: { id: documentId } });
  try {
    await unlink(join(STORAGE_DIR, document.url));
  } catch (error) {
    this.logger.warn(`Failed to unlink document file for ${documentId}: ${(error as Error).message}`);
  }
}
```

With HR operations complete, Part 10 moves to the frontend — starting with the architectural patterns (API client, auth/branding context) that every page in Part 11 builds on.
