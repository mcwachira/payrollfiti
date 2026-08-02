# Part 11 — Frontend Application Pages

## 11.1 The Authenticated Shell

`(app)/layout.tsx` wraps every authenticated route in `AuthGuard`, the sidebar, and the header:

```typescript
// app/(app)/layout.tsx
export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background`}>
      <AuthGuard>
        <MobileSidebarProvider>
          <Sidebar />
          <div className="lg:pl-64">
            <AppHeader />
            <main className="py-6"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">{children}</div></main>
          </div>
        </MobileSidebarProvider>
      </AuthGuard>
    </div>
  );
}
```

`AuthGuard` is the client-side route protection layer — it redirects to `/login` the moment `useAuth()` resolves with no user, and renders a spinner rather than a flash of protected content while that resolution is still in flight:

```typescript
// components/AuthGuard.tsx
export function AuthGuard({ children }: PropsWithChildren) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return <div className="flex min-h-screen items-center justify-center"><Spinner /></div>;
  }
  return <>{children}</>;
}
```

`RoleGuard` layers finer-grained UI-level restriction *inside* a page that's already past `AuthGuard` — for pages or sections only ADMIN/HR should see, mirroring the backend's `@Roles()` decorator (Part 4 §4.5) but as a rendering guard rather than a request guard (the actual authorization is always still enforced server-side; this only controls what's shown):

```typescript
// components/RoleGuard.tsx
export function RoleGuard({ allow, children }: PropsWithChildren<{ allow: Role[] }>) {
  const { user } = useAuth();
  if (!user || !allow.includes(user.role)) {
    return <Card><CardContent className="p-6"><p className="text-muted-foreground">You don't have permission to view this page.</p></CardContent></Card>;
  }
  return <>{children}</>;
}
```

## 11.2 Page Inventory

| Route | Purpose |
|---|---|
| `/dashboard` | Headline metrics (headcount, latest run totals, pending approvals) |
| `/employees` | List + create/edit employee, onboarding checklist, contracts, salary structures |
| `/payroll` | Run payroll, list past runs |
| `/payroll/[id]` | Run detail: totals, per-employee entries, payslip + bank export downloads |
| `/loans` | Request/approve/reject/pay-off loans, repayment schedules |
| `/leave` | Leave types, balances, request/approve leave |
| `/analytics` | Department cost breakdown, leave usage trends |
| `/compliance` | Generate P9/P10/NSSF/NHIF (KE), PAYE/pension/NHF (NG), EMP201/IRP5 (ZA) |
| `/billing` | Subscription, plan, invoices, pay-invoice |
| `/settings` | Company details, branding (logo/color), salary components |
| `/employee-portal` | Self-service: my payslips, my leave, my loans, my documents |

Every list/detail page follows the same three-layer pattern: a `lib/*-api.ts` typed client (Part 10 §10.2), a React Query `useQuery`/`useMutation` pair, and a shadcn/ui component tree with explicit loading/error/empty states — never a bare fetch-in-`useEffect`.

## 11.3 Template: Payroll Run List → Detail

The `/payroll` list page fetches runs for the current company and lets ADMIN/HR trigger a new run:

```typescript
// app/(app)/payroll/page.tsx
const runsQuery = useQuery({ queryKey: ['payrollRuns', companyId], queryFn: () => listPayrollRuns(companyId!), enabled: !!companyId });

const runPayrollMutation = useMutation({
  mutationFn: runPayroll,
  onSuccess: (run) => {
    toast.success(`Payroll run created for ${run.period}`);
    queryClient.invalidateQueries({ queryKey: ['payrollRuns'] });
    router.push(`/payroll/${run.id}`); // navigates straight to the detail route rather than an inline expand
  },
  onError: (error) => toast.error('Failed to run payroll', { description: error instanceof ApiError ? error.message : undefined }),
});
```

`/payroll/[id]` is a real route (not a client-side modal/expand) — this matters because a payroll run detail is something people bookmark, link in Slack, or revisit days later, and a real URL survives all three:

```typescript
// app/(app)/payroll/[id]/page.tsx
export default function PayrollRunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); // React 19's `use()` unwraps the Next.js 15 async params promise directly in the component body

  const runQuery = useQuery({ queryKey: ['payrollRun', id], queryFn: () => getPayrollRun(id) });

  const handleDownloadPayslip = async (entryId: string) => {
    try { await downloadPayslip(entryId); } catch (err) { toast.error(errorMessage(err, 'Failed to download payslip')); }
  };

  if (runQuery.isLoading) return <PageSkeleton cards={3} rows={5} />;
  if (runQuery.error) return <ErrorState message={errorMessage(runQuery.error, 'Failed to load payroll run')} />;

  const run = runQuery.data!;
  return (
    <>
      <SummaryCards totals={run.totals} status={run.status} />
      <Button onClick={() => downloadBankExport(run.id, run.period)}><Download />Bank Export</Button>
      <Table>
        {run.entries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell>{entry.employee.firstName} {entry.employee.lastName}</TableCell>
            <TableCell>{formatCurrency(entry.netPay, entry.currency)}</TableCell>
            <TableCell><Button size="sm" onClick={() => handleDownloadPayslip(entry.id)}><FileDown />Payslip</Button></TableCell>
          </TableRow>
        ))}
      </Table>
    </>
  );
}
```

`PageSkeleton` is a shared shimmer-block component used across every list/detail page for the loading state — one component, consistent loading UX everywhere, instead of each page inventing its own spinner.

## 11.4 Template: Create → Approve Mutation Flow (Loans)

The Loans page demonstrates the full read-modify-write cycle a lot of the HR pages share: a dialog-based create form, a role-gated approval action, and cache invalidation tying them together.

```typescript
// app/(app)/loans/page.tsx
function NewLoanDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState('');
  const [principal, setPrincipal] = useState('');
  // ...installments, startPeriod, reason

  const createMutation = useMutation({
    mutationFn: () => createLoan({ employeeId, principal: Number(principal), installments: Number(installments), startPeriod, reason: reason || undefined }),
    onSuccess: () => {
      toast.success('Loan request created — pending approval');
      setOpen(false);
      setEmployeeId(''); setPrincipal(''); // reset form state
      onCreated(); // triggers the parent's queryClient.invalidateQueries
    },
    onError: (error) => toast.error('Could not create the loan request', { description: errorMessage(error, 'Please check the details and try again') }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus />New Loan Request</Button></DialogTrigger>
      <DialogContent>{/* form fields, submit calls createMutation.mutate() */}</DialogContent>
    </Dialog>
  );
}
```

Approval/rejection is gated to ADMIN/HR at the UI layer with `RoleGuard` (§11.1), and the actual mutation (`decideLoan`) is a thin wrapper calling `POST /loans/:id/decide` — the same endpoint Part 9 §9.2's `LoansService.decide` implements, with the identical `LOAN_MANAGE` permission enforced server-side regardless of what the UI shows or hides.

## 11.5 Analytics — Real Data, Not Mock Fixtures

`PayrollAnalytics` derives every chart from live API data rather than a static fixture file: department cost breakdown groups active employees by `Employee.department` and sums each one's current `basicSalary` (from their active `SalaryStructure`, resolved the same way `EmployeesService.getActiveSalaryStructure` does — Part 5 §5.1); leave usage aggregates approved `LeaveRequest.daysRequested` by month. Both are plain client-side reductions over data already fetched via the existing `employees-api`/`leave-api` clients — no separate analytics-specific backend endpoint was needed for either chart.

## 11.6 Employee Self-Service Portal

`/employee-portal` reuses the same `lib/*-api.ts` clients as the admin pages, but every underlying endpoint enforces "own records only" server-side for an `EMPLOYEE`-role caller — the pattern established in Part 5 (`PayslipsService.generate`), Part 9 (`DocumentsService.assertAccess`), and mirrored in `PayrollService.findMine`/`LeaveService.findMine`/`LoansService.findMine`, all of which key off `AuthenticatedRequestUser.employeeId` embedded in the JWT (Part 4 §4.4) rather than trusting a client-supplied employee ID. The frontend page itself is a tabbed view (Overview / Payslips / Leave / Loans / Documents) built from those same `findMine`-style read endpoints, so there is no separate "employee" backend module — just role-scoped views over the same data admin/HR see for everyone.

## 11.7 Payslip Branding on the Frontend

`/settings` exposes logo upload and primary/secondary color pickers backed by `BrandingConfig` (Part 2 §2.3 Cluster 1). Saving triggers `BrandingContext.refreshBranding()` (Part 10 §10.3), which immediately updates the app shell's own rendered color/logo — the same `BrandingConfigDto` shape is what `PayslipsService`/`ComplianceReportsService` (Parts 5–6) read server-side to brand generated PDFs, so what an admin sees previewed in Settings is what actually appears on a real payslip, not a decorative-only setting.

With every application page built on the same foundation, Part 12 closes out the guide with testing strategy, Docker/CI deployment, and the full environment-variable reference needed to actually run all of this.
