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
import { Check, X, Clock } from 'lucide-react';
import { toast } from 'sonner';
import {
  listLeaveRequests,
  decideLeaveRequest,
  type LeaveRequest,
} from '@/lib/leave-api';
import { ApiError } from '@/lib/api-client';
import { PageSkeleton } from '@/components/ui/loading-skeleton';

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function getStatusBadge(status: LeaveRequest['status']) {
  switch (status) {
    case 'APPROVED':
      return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
    case 'REJECTED':
      return <Badge variant="destructive">Rejected</Badge>;
    default:
      return <Badge variant="secondary">Pending</Badge>;
  }
}

function LeaveRequestRow({
  request,
  onDecide,
  deciding,
}: {
  request: LeaveRequest;
  onDecide?: (decision: 'APPROVED' | 'REJECTED') => void;
  deciding: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="space-y-1">
        <h4 className="font-medium">
          {request.employee
            ? `${request.employee.firstName} ${request.employee.lastName}`
            : 'Employee'}
        </h4>
        <p className="text-sm text-muted-foreground">
          {request.employee?.employeeNumber ?? '—'}
        </p>
        <p className="text-sm">
          <span className="font-medium">
            {request.leaveType?.name ?? 'Leave'}
          </span>{' '}
          • {request.daysRequested} day{request.daysRequested === 1 ? '' : 's'}
        </p>
        <p className="text-xs text-muted-foreground">
          {new Date(request.startDate).toLocaleDateString()} -{' '}
          {new Date(request.endDate).toLocaleDateString()}
        </p>
        {request.reason && (
          <p className="text-xs text-muted-foreground">
            Reason: {request.reason}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {getStatusBadge(request.status)}
        {request.status === 'PENDING' && onDecide && (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={deciding}
              onClick={() => onDecide('REJECTED')}
            >
              <X className="h-4 w-4 mr-1" />
              Reject
            </Button>
            <Button
              size="sm"
              disabled={deciding}
              onClick={() => onDecide('APPROVED')}
            >
              <Check className="h-4 w-4 mr-1" />
              Approve
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default function LeaveManagementPage() {
  const queryClient = useQueryClient();
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const pendingQuery = useQuery({
    queryKey: ['leaveRequests', 'PENDING'],
    queryFn: () => listLeaveRequests({ status: 'PENDING' }),
  });

  const allQuery = useQuery({
    queryKey: ['leaveRequests', 'all'],
    queryFn: () => listLeaveRequests(),
  });

  const decideMutation = useMutation({
    mutationFn: ({
      id,
      decision,
    }: {
      id: string;
      decision: 'APPROVED' | 'REJECTED';
    }) => decideLeaveRequest(id, decision),
    onMutate: ({ id }) => setDecidingId(id),
    onSuccess: (_, { decision }) => {
      toast.success(
        decision === 'APPROVED'
          ? 'Leave request approved'
          : 'Leave request rejected',
      );
      queryClient.invalidateQueries({ queryKey: ['leaveRequests'] });
    },
    onError: (error) =>
      toast.error('Could not update the leave request', {
        description: errorMessage(error, 'Please try again'),
      }),
    onSettled: () => setDecidingId(null),
  });

  if (pendingQuery.isLoading) return <PageSkeleton />;

  const pending = pendingQuery.data ?? [];
  const all = allQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Leave Management</h1>
        <p className="text-muted-foreground">
          Review and decide on employee leave requests
        </p>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">
            Pending Requests {pending.length > 0 && `(${pending.length})`}
          </TabsTrigger>
          <TabsTrigger value="history">Leave History</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Leave Requests</CardTitle>
              <CardDescription>
                Approve or reject employee leave requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pending.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No pending leave requests
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pending.map((request) => (
                    <LeaveRequestRow
                      key={request.id}
                      request={request}
                      deciding={decidingId === request.id}
                      onDecide={(decision) =>
                        decideMutation.mutate({ id: request.id, decision })
                      }
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Leave History</CardTitle>
              <CardDescription>
                All leave requests and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {all.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No leave requests yet
                </p>
              ) : (
                <div className="space-y-4">
                  {all.map((request) => (
                    <LeaveRequestRow
                      key={request.id}
                      request={request}
                      deciding={false}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
