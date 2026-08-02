'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Check, X, Clock, Wallet, Plus, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { Role } from '@repo/api';
import { RoleGuard } from '@/components/RoleGuard';
import {
  listLoans,
  createLoan,
  decideLoan,
  payoffLoan,
  getLoan,
  type Loan,
} from '@/lib/loans-api';
import { listCompanies, listEmployees } from '@/lib/employees-api';
import { ApiError } from '@/lib/api-client';
import { getLoanStatusColor } from '@/lib/status-styles';
import { PageSkeleton } from '@/components/ui/loading-skeleton';

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function LoanRow({
  loan,
  onDecide,
  onPayoff,
  onViewSchedule,
  busy,
}: {
  loan: Loan;
  onDecide?: (decision: 'APPROVED' | 'REJECTED') => void;
  onPayoff?: () => void;
  onViewSchedule: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="space-y-1">
        <h4 className="font-medium">
          {loan.employee
            ? `${loan.employee.firstName} ${loan.employee.lastName}`
            : 'Employee'}
        </h4>
        <p className="text-sm text-muted-foreground">
          {loan.employee?.employeeNumber ?? '—'}
        </p>
        <p className="text-sm">
          <span className="font-medium">
            {formatMoney(loan.principal, loan.currency)}
          </span>{' '}
          • {loan.installments} installment{loan.installments === 1 ? '' : 's'}
          {loan.installmentAmount
            ? ` of ${formatMoney(loan.installmentAmount, loan.currency)}`
            : ''}
        </p>
        <p className="text-xs text-muted-foreground">
          Starting {loan.startPeriod}
        </p>
        {loan.reason && (
          <p className="text-xs text-muted-foreground">Reason: {loan.reason}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Badge className={getLoanStatusColor(loan.status)}>
          {loan.status.replace('_', ' ')}
        </Badge>
        <Button variant="ghost" size="sm" onClick={onViewSchedule}>
          <Receipt className="h-4 w-4" />
        </Button>
        {loan.status === 'PENDING' && onDecide && (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => onDecide('REJECTED')}
            >
              <X className="h-4 w-4 mr-1" />
              Reject
            </Button>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => onDecide('APPROVED')}
            >
              <Check className="h-4 w-4 mr-1" />
              Approve
            </Button>
          </>
        )}
        {loan.status === 'ACTIVE' && onPayoff && (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={onPayoff}
          >
            Pay Off
          </Button>
        )}
      </div>
    </div>
  );
}

function NewLoanDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState('');
  const [principal, setPrincipal] = useState('');
  const [installments, setInstallments] = useState('1');
  const [startPeriod, setStartPeriod] = useState(currentPeriod());
  const [reason, setReason] = useState('');

  const companiesQuery = useQuery({
    queryKey: ['companies'],
    queryFn: listCompanies,
  });
  const companyId = companiesQuery.data?.[0]?.id ?? null;

  const employeesQuery = useQuery({
    queryKey: ['employees', companyId],
    queryFn: () => listEmployees(companyId!),
    enabled: !!companyId && open,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createLoan({
        employeeId,
        principal: Number(principal),
        installments: Number(installments),
        startPeriod,
        reason: reason || undefined,
      }),
    onSuccess: () => {
      toast.success('Loan request created — pending approval');
      setOpen(false);
      setEmployeeId('');
      setPrincipal('');
      setInstallments('1');
      setReason('');
      onCreated();
    },
    onError: (error) =>
      toast.error('Could not create the loan request', {
        description: errorMessage(
          error,
          'Please check the details and try again',
        ),
      }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Loan Request
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a Loan or Advance</DialogTitle>
          <DialogDescription>
            Creates a pending loan on behalf of an employee — it won&apos;t
            deduct from payroll until approved.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Employee</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an employee" />
              </SelectTrigger>
              <SelectContent>
                {employeesQuery.data?.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.firstName} {employee.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="principal">Amount</Label>
              <Input
                id="principal"
                type="number"
                min={1}
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="installments">Installments</Label>
              <Input
                id="installments"
                type="number"
                min={1}
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="startPeriod">First deduction period</Label>
            <Input
              id="startPeriod"
              type="month"
              value={startPeriod}
              onChange={(e) => setStartPeriod(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <Button
            className="w-full"
            disabled={
              !employeeId ||
              !principal ||
              !installments ||
              createMutation.isPending
            }
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? 'Submitting…' : 'Submit Request'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleDialog({
  loanId,
  onOpenChange,
}: {
  loanId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const loanQuery = useQuery({
    queryKey: ['loan', loanId],
    queryFn: () => getLoan(loanId!),
    enabled: !!loanId,
  });
  const loan = loanQuery.data;

  return (
    <Dialog open={!!loanId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Repayment Schedule</DialogTitle>
          {loan && (
            <DialogDescription>
              {loan.employee
                ? `${loan.employee.firstName} ${loan.employee.lastName} — `
                : ''}
              Balance remaining: {formatMoney(loan.balance ?? 0, loan.currency)}
            </DialogDescription>
          )}
        </DialogHeader>
        {loanQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {loan?.repayments?.length ? (
              loan.repayments.map((repayment) => (
                <div
                  key={repayment.id}
                  className="flex items-center justify-between p-2 border rounded text-sm"
                >
                  <span>
                    #{repayment.installmentNo} — {repayment.period}
                  </span>
                  <span>{formatMoney(repayment.amountDue, loan.currency)}</span>
                  <Badge variant="outline">{repayment.status}</Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No repayment schedule yet — the loan hasn&apos;t been approved.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LoansPageContent() {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scheduleLoanId, setScheduleLoanId] = useState<string | null>(null);

  const pendingQuery = useQuery({
    queryKey: ['loans', 'PENDING'],
    queryFn: () => listLoans({ status: 'PENDING' }),
  });

  const allQuery = useQuery({
    queryKey: ['loans', 'all'],
    queryFn: () => listLoans(),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['loans'] });

  const decideMutation = useMutation({
    mutationFn: ({
      id,
      decision,
    }: {
      id: string;
      decision: 'APPROVED' | 'REJECTED';
    }) => decideLoan(id, decision),
    onMutate: ({ id }) => setBusyId(id),
    onSuccess: (_, { decision }) => {
      toast.success(
        decision === 'APPROVED' ? 'Loan approved' : 'Loan rejected',
      );
      invalidate();
    },
    onError: (error) =>
      toast.error('Could not update the loan', {
        description: errorMessage(error, 'Please try again'),
      }),
    onSettled: () => setBusyId(null),
  });

  const payoffMutation = useMutation({
    mutationFn: (id: string) => payoffLoan(id),
    onMutate: (id) => setBusyId(id),
    onSuccess: () => {
      toast.success('Loan marked paid off');
      invalidate();
    },
    onError: (error) =>
      toast.error('Could not pay off the loan', {
        description: errorMessage(error, 'Please try again'),
      }),
    onSettled: () => setBusyId(null),
  });

  if (pendingQuery.isLoading) return <PageSkeleton />;

  const pending = pendingQuery.data ?? [];
  const all = allQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Loans & Advances</h1>
          <p className="text-muted-foreground">
            Review, approve, and track employee loan requests
          </p>
        </div>
        <NewLoanDialog onCreated={invalidate} />
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">
            Pending Approval {pending.length > 0 && `(${pending.length})`}
          </TabsTrigger>
          <TabsTrigger value="all">All Loans</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Loan Requests</CardTitle>
              <CardDescription>
                Approve or reject requests before they affect payroll
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pending.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No pending loan requests
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pending.map((loan) => (
                    <LoanRow
                      key={loan.id}
                      loan={loan}
                      busy={busyId === loan.id}
                      onDecide={(decision) =>
                        decideMutation.mutate({ id: loan.id, decision })
                      }
                      onViewSchedule={() => setScheduleLoanId(loan.id)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Loans</CardTitle>
              <CardDescription>
                Every loan and advance across the company
              </CardDescription>
            </CardHeader>
            <CardContent>
              {all.length === 0 ? (
                <div className="text-center py-8">
                  <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No loans yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {all.map((loan) => (
                    <LoanRow
                      key={loan.id}
                      loan={loan}
                      busy={busyId === loan.id}
                      onPayoff={
                        loan.status === 'ACTIVE'
                          ? () => payoffMutation.mutate(loan.id)
                          : undefined
                      }
                      onViewSchedule={() => setScheduleLoanId(loan.id)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ScheduleDialog
        loanId={scheduleLoanId}
        onOpenChange={(open) => !open && setScheduleLoanId(null)}
      />
    </div>
  );
}

export default function LoansPage() {
  return (
    <RoleGuard allow={[Role.ADMIN, Role.HR]}>
      <LoansPageContent />
    </RoleGuard>
  );
}
