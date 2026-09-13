'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  getEmployee,
  listOnboardingTasks,
  type Employee,
} from '@/lib/employees-api';
import { toast } from 'sonner';

const STATUS_COLORS: Record<
  string,
  'default' | 'neutral'
> = {
  active: 'default',
  inactive: 'neutral',
  on_leave: 'neutral',
};

export default function EmployeeDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();

  const employeeQuery = useQuery({
    queryKey: ['employee', id],
    queryFn: () => getEmployee(id),
    enabled: !!id,
  });

  const onboardingQuery = useQuery({
    queryKey: ['onboarding-tasks', id],
    queryFn: () => listOnboardingTasks(id),
    enabled: !!id,
  });

  const employee = employeeQuery.data as Employee | undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="neutral" size="icon">
          <Link href="/employees">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold font-heading">
            {employee
              ? `${employee.firstName} ${employee.lastName}`
              : 'Employee'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {employee?.email ?? 'Loading...'}
          </p>
        </div>
      </div>

      {employeeQuery.isPending ? (
        <Card>
          <CardContent className="py-6">
            <Skeleton className="h-6 w-full" />
          </CardContent>
        </Card>
      ) : employeeQuery.isError ? (
        <Card>
          <CardContent className="py-6 text-red-600">
            Failed to load employee.
          </CardContent>
        </Card>
      ) : employee ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-heading">
                Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground">Employee Number</p>
                  <p className="font-medium">
                    {employee.employeeNumber ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge
                    variant={
                      STATUS_COLORS[employee.status] ?? 'outline'
                    }
                  >
                    {employee.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Country</p>
                  <p className="font-medium">{employee.country}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Hire Date</p>
                  <p className="font-medium">{employee.hireDate}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium">{employee.phone ?? '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Termination Date</p>
                  <p className="font-medium">
                    {employee.terminationDate ?? '—'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-heading">
                Onboarding Tasks
              </CardTitle>
              <CardDescription>
                {onboardingQuery.data?.length ?? 0} tasks
              </CardDescription>
            </CardHeader>
            <CardContent>
              {onboardingQuery.isPending ? (
                <Skeleton className="h-20 w-full" />
              ) : onboardingQuery.data && onboardingQuery.data.length > 0 ? (
                <div className="space-y-3">
                  {onboardingQuery.data.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {task.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {task.isRequired ? 'Required' : 'Optional'}
                        </p>
                      </div>
                      <Badge
                        variant={
                          task.completed ? 'default' : 'neutral'
                        }
                      >
                        {task.completed ? 'Completed' : 'Pending'}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No onboarding tasks.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
