'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { EmployeeList } from '@/components/employees/EmployeeList';
import {
  listCompanies,
  listEmployees,
  toEmployeeListItem,
} from '@/lib/employees-api';
import { Role } from '@repo/api';
import { RoleRedirectGuard } from '@/components/RoleRedirectGuard';
import { ApiError } from '@/lib/api-client';
import { PageSkeleton } from '@/components/ui/loading-skeleton';

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

const EmployeesPage = () => {
  const queryClient = useQueryClient();

  const companiesQuery = useQuery({
    queryKey: ['companies'],
    queryFn: listCompanies,
  });
  const companyId = companiesQuery.data?.[0]?.id ?? null;

  const employeesQuery = useQuery({
    queryKey: ['employees', companyId],
    queryFn: () => listEmployees(companyId!),
    enabled: !!companyId,
  });

  const isLoading =
    companiesQuery.isPending || (!!companyId && employeesQuery.isPending);
  const error = companiesQuery.error ?? employeesQuery.error;

  if (isLoading) {
    return <PageSkeleton cards={4} rows={6} />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-red-600 dark:text-red-400">
            Error loading employees:{' '}
            {errorMessage(error, 'Failed to load employees')}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!companyId) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">
            No company set up for this tenant yet. Create a company under
            Settings before adding employees.
          </p>
        </CardContent>
      </Card>
    );
  }

  const employees = (employeesQuery.data ?? []).map(toEmployeeListItem);

  return (
    <div className="container mx-auto p-6">
      <EmployeeList
        employees={employees}
        companyId={companyId}
        onEmployeeSaved={() =>
          queryClient.invalidateQueries({ queryKey: ['employees', companyId] })
        }
      />
    </div>
  );
};

export default function EmployeesPageGuarded() {
  return (
    <RoleRedirectGuard allow={[Role.ADMIN, Role.HR]}>
      <EmployeesPage />
    </RoleRedirectGuard>
  );
}
