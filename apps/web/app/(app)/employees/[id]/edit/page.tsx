'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getEmployee, listCompanies, updateEmployee } from '@/lib/employees-api';
import { ApiError } from '@/lib/api-client';
import { toast } from 'sonner';
import type { CreateEmployeeInput } from '@/lib/employees-api';

export default function EditEmployeePage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();

  const employeeQuery = useQuery({
    queryKey: ['employee', id],
    queryFn: () => getEmployee(id),
    enabled: !!id,
  });

  const [form, setForm] = useState<Partial<CreateEmployeeInput>>({});

  const companiesQuery = useQuery({
    queryKey: ['companies'],
    queryFn: listCompanies,
  });

  const mutation = useMutation({
    mutationFn: () =>
      updateEmployee(id, form as Partial<CreateEmployeeInput>),
    onSuccess: () => {
      toast.success('Employee updated');
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error) => {
      toast.error('Could not update employee', {
        description: error instanceof ApiError ? error.message : undefined,
      });
    },
  });

  const employee = employeeQuery.data;

  if (employeeQuery.isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="space-y-6">
        <p className="text-red-600">Employee not found.</p>
        <Button asChild variant="neutral">
          <Link href="/employees">Back to employees</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="neutral" size="icon">
          <Link href={`/employees/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold font-heading">
            Edit Employee
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {employee.firstName} {employee.lastName}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading">
            Employee Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="companyId">Company</Label>
                <Select
                  value={form.companyId ?? employee.companyId}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, companyId: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {companiesQuery.data?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="employeeNumber">Employee Number</Label>
                <Input
                  id="employeeNumber"
                  value={form.employeeNumber ?? employee.employeeNumber ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      employeeNumber: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={form.firstName ?? employee.firstName}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      firstName: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={form.lastName ?? employee.lastName}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      lastName: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email ?? employee.email ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      email: e.target.value || undefined,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={form.phone ?? employee.phone ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      phone: e.target.value || undefined,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country Code</Label>
                <Input
                  id="country"
                  value={form.country ?? employee.country}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      country: e.target.value,
                    }))
                  }
                  maxLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hireDate">Hire Date</Label>
                <Input
                  id="hireDate"
                  type="date"
                  value={form.hireDate ?? employee.hireDate}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      hireDate: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={form.status ?? employee.status}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      status: v as CreateEmployeeInput['status'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="on_leave">On Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button asChild variant="neutral" type="button">
                <Link href={`/employees/${id}`}>Cancel</Link>
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
