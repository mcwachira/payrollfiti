'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
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
import { useAuth } from '@/contexts/AuthContext';
import { listCompanies } from '@/lib/employees-api';
import { createEmployee } from '@/lib/employees-api';
import { ApiError } from '@/lib/api-client';
import { toast } from 'sonner';
import type { CreateEmployeeInput } from '@/lib/employees-api';

export default function NewEmployeePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [form, setForm] = useState<CreateEmployeeInput>({
    companyId: '',
    employeeNumber: '',
    firstName: '',
    lastName: '',
    country: '',
    hireDate: new Date().toISOString().split('T')[0],
    status: 'active',
  });

  const companiesQuery = useQuery({
    queryKey: ['companies'],
    queryFn: listCompanies,
  });

  const mutation = useMutation({
    mutationFn: createEmployee,
    onSuccess: () => {
      toast.success('Employee created');
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      router.push('/employees');
    },
    onError: (error) => {
      toast.error('Could not create employee', {
        description: error instanceof ApiError ? error.message : undefined,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="neutral" size="icon">
          <Link href="/employees">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold font-heading">New Employee</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Add a new employee to your workspace.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading">
            Employee Details
          </CardTitle>
          <CardDescription>
            Fields marked with * are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="companyId">Company *</Label>
                <Select
                  value={form.companyId}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, companyId: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select company" />
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
                <Label htmlFor="employeeNumber">Employee Number *</Label>
                <Input
                  id="employeeNumber"
                  value={form.employeeNumber}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      employeeNumber: e.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      firstName: e.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      lastName: e.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email ?? ''}
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
                  value={form.phone ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      phone: e.target.value || undefined,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country Code *</Label>
                <Input
                  id="country"
                  value={form.country}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      country: e.target.value,
                    }))
                  }
                  required
                  maxLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hireDate">Hire Date *</Label>
                <Input
                  id="hireDate"
                  type="date"
                  value={form.hireDate}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      hireDate: e.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={form.status}
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
                <Link href="/employees">Cancel</Link>
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Create Employee
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
