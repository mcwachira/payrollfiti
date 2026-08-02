'use client';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Wallet, AlertTriangle } from 'lucide-react';
import { listMyLeaveRequests } from '@/lib/leave-api';
import { listMyLoans } from '@/lib/loans-api';
import {
  getLeaveRequestStatusColor,
  getLoanStatusColor,
} from '@/lib/status-styles';
import { ApiError } from '@/lib/api-client';

type Application =
  | {
      kind: 'leave';
      id: string;
      title: string;
      detail: string;
      status: string;
      statusColor: string;
      submittedAt: string;
    }
  | {
      kind: 'loan';
      id: string;
      title: string;
      detail: string;
      status: string;
      statusColor: string;
      submittedAt: string;
    };

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Combines leave requests and loan requests into one status-tracked feed —
 * "applications" from the employee's point of view are really two separate
 * backend resources (LeaveRequest, Loan), each already scoped to "mine" via
 * their own findMine-style endpoint. This is purely a read-side merge, no
 * new backend endpoint needed.
 */
export default function MyApplications() {
  const leaveQuery = useQuery({
    queryKey: ['leave-requests', 'mine'],
    queryFn: listMyLeaveRequests,
  });
  const loansQuery = useQuery({
    queryKey: ['loans', 'mine'],
    queryFn: listMyLoans,
  });

  const isLoading = leaveQuery.isPending || loansQuery.isPending;
  const error = leaveQuery.error ?? loansQuery.error;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground text-sm">
            Loading your applications…
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
            <p>
              {error instanceof ApiError
                ? error.message
                : 'Failed to load your applications'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const leaveApplications: Application[] = (leaveQuery.data ?? []).map((r) => ({
    kind: 'leave',
    id: r.id,
    title: r.leaveType?.name ?? 'Leave',
    detail: `${formatDate(r.startDate)} – ${formatDate(r.endDate)} (${r.daysRequested} day${r.daysRequested === 1 ? '' : 's'})`,
    status: r.status,
    statusColor: getLeaveRequestStatusColor(r.status),
    submittedAt: r.createdAt,
  }));

  const loanApplications: Application[] = (loansQuery.data ?? []).map((l) => ({
    kind: 'loan',
    id: l.id,
    title: 'Loan / Advance',
    detail: `${formatMoney(l.principal, l.currency)} over ${l.installments} installment${l.installments === 1 ? '' : 's'}`,
    status: l.status,
    statusColor: getLoanStatusColor(l.status),
    submittedAt: l.createdAt,
  }));

  const applications = [...leaveApplications, ...loanApplications].sort(
    (a, b) =>
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Applications</CardTitle>
        <CardDescription>
          Track your leave applications and other requests
        </CardDescription>
      </CardHeader>
      <CardContent>
        {applications.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">
            You haven&apos;t submitted any leave or loan requests yet.
          </p>
        ) : (
          <div className="space-y-3">
            {applications.map((app) => (
              <div
                key={`${app.kind}-${app.id}`}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-start gap-3">
                  {app.kind === 'leave' ? (
                    <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                  ) : (
                    <Wallet className="h-4 w-4 text-muted-foreground mt-0.5" />
                  )}
                  <div>
                    <h4 className="font-medium">{app.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {app.detail}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Submitted {formatDate(app.submittedAt)}
                    </p>
                  </div>
                </div>
                <Badge className={app.statusColor}>{app.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
