'use client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from 'lucide-react';
import { listLeaveTypes, listLeaveBalances } from '@/lib/leave-api';
import { ApiError } from '@/lib/api-client';

interface LeaveBalanceProps {
  employeeId: string;
}

export default function LeaveBalance({ employeeId }: LeaveBalanceProps) {
  const typesQuery = useQuery({
    queryKey: ['leave-types'],
    queryFn: listLeaveTypes,
  });
  const balancesQuery = useQuery({
    queryKey: ['leave-balances', employeeId],
    queryFn: () => listLeaveBalances(employeeId),
  });

  const isLoading = typesQuery.isPending || balancesQuery.isPending;
  const error = typesQuery.error ?? balancesQuery.error;

  if (isLoading) return <div>Loading leave balances...</div>;

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Leave Balances
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600 dark:text-red-400">
            {error instanceof ApiError
              ? error.message
              : 'Failed to load leave balances'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const typeNames = new Map((typesQuery.data ?? []).map((t) => [t.id, t.name]));
  const balances = balancesQuery.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Leave Balances
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {balances.length === 0 ? (
            <p className="text-muted-foreground">No leave balances found</p>
          ) : (
            balances.map((balance) => {
              const remaining = balance.accruedDays - balance.usedDays;
              return (
                <div
                  key={balance.id}
                  className="flex justify-between items-center p-3 border rounded-lg"
                >
                  <div>
                    <h4 className="font-medium">
                      {typeNames.get(balance.leaveTypeId) ?? 'Leave'}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Used: {balance.usedDays} of {balance.accruedDays} accrued
                      days
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={remaining > 0 ? 'secondary' : 'destructive'}
                    >
                      {remaining} days remaining
                    </Badge>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
