'use client';
import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { EmployeeList } from '@/components/employees/EmployeeList';
import { listCompanies, listEmployees, toEmployeeListItem } from '@/lib/employees-api';
import { ApiError } from '@/lib/api-client';

const EmployeesPage = () => {
  const [employees, setEmployees] = useState<ReturnType<typeof toEmployeeListItem>[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const companies = await listCompanies();
        if (companies.length === 0) {
          if (!cancelled) {
            setEmployees([]);
            setCompanyId(null);
          }
          return;
        }
        const results = await listEmployees(companies[0]!.id);
        if (!cancelled) {
          setCompanyId(companies[0]!.id);
          setEmployees(results.map(toEmployeeListItem));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load employees');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-red-600">Error loading employees: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!companyId) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">
            No company set up for this tenant yet. Create a company under Settings before adding employees.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <EmployeeList
        employees={employees}
        companyId={companyId}
        onEmployeeSaved={() => setReloadToken((token) => token + 1)}
      />
    </div>
  );
};

export default EmployeesPage;
