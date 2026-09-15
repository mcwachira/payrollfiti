'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2 } from 'lucide-react';
import { useState } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  listAttendanceRecords,
  markAbsent,
  type AttendanceRecord,
} from '@/lib/attendance-api';
import { listCompanies, listEmployees } from '@/lib/employees-api';
import { useAuth } from '@/contexts/AuthContext';
import { Role } from '@/shared-types';
import { RoleGuard } from '@/components/RoleGuard';
import { ApiError } from '@/lib/api-client';
import { toast } from 'sonner';
import { format } from 'date-fns';

const STATUS_COLORS: Record<
  string,
  'default' | 'neutral'
> = {
  present: 'default',
  absent: 'default',
  leave: 'neutral',
  holiday: 'neutral',
};

export default function AttendancePage() {
  const [companyId, setCompanyId] = useState('');
  const [date, setDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [open, setOpen] = useState(false);

  const companiesQuery = useQuery({
    queryKey: ['companies'],
    queryFn: listCompanies,
  });

  const recordsQuery = useQuery({
    queryKey: ['attendance', companyId, date],
    queryFn: () => listAttendanceRecords(companyId),
    enabled: !!companyId,
  });

  const [form, setForm] = useState({
    companyId: '',
    employeeId: '',
    attendanceDate: new Date().toISOString().split('T')[0],
  });

  const employeesQuery = useQuery({
    queryKey: ['employees', form.companyId],
    queryFn: () => listEmployees(form.companyId, 1, 100),
    enabled: !!form.companyId,
  });

  const markAbsentMutation = useMutation({
    mutationFn: markAbsent,
    onSuccess: () => {
      toast.success('Marked as absent');
      setOpen(false);
      setForm({
        companyId: '',
        employeeId: '',
        attendanceDate: new Date().toISOString().split('T')[0],
      });
      recordsQuery.refetch();
    },
    onError: (error) => {
      toast.error('Could not mark absent', {
        description: error instanceof ApiError ? error.message : undefined,
      });
    },
  });

  const handleMarkAbsent = (e: React.FormEvent) => {
    e.preventDefault();
    markAbsentMutation.mutate(form);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">
            Attendance
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Track employee attendance.
          </p>
        </div>
        <RoleGuard allow={[Role.ADMIN, Role.HR]}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Mark Absent
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Mark Absent</DialogTitle>
                <DialogDescription>
                  Mark an employee as absent for a date.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleMarkAbsent} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyId">Company</Label>
                  <Select
                    value={form.companyId}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, companyId: v, employeeId: '' }))
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
                  <Label htmlFor="employeeId">Employee</Label>
                  <Select
                    value={form.employeeId}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, employeeId: v }))
                    }
                    disabled={!form.companyId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employeesQuery.data?.data.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.firstName} {e.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="attendanceDate">Date</Label>
                  <Input
                    id="attendanceDate"
                    type="date"
                    value={form.attendanceDate}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        attendanceDate: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="neutral"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={markAbsentMutation.isPending}>
                    {markAbsentMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Mark Absent
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </RoleGuard>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading">
            Attendance Records
          </CardTitle>
          <CardDescription>
            {recordsQuery.data?.length ?? 0} records found.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row mb-4">
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select Company</option>
              {companiesQuery.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="sm:w-auto"
            />
          </div>

          {!companyId ? (
            <p className="text-muted-foreground text-sm">
              Select a company to view attendance records.
            </p>
          ) : recordsQuery.isPending ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : recordsQuery.data && recordsQuery.data.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recordsQuery.data.map((record: AttendanceRecord) => (
                    <TableRow key={record.id}>
                      <TableCell className="text-sm">
                        {record.employeeId}
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(record.attendanceDate), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-sm">
                        {record.clockedInAt
                          ? format(new Date(record.clockedInAt), 'HH:mm')
                          : '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {record.clockedOutAt
                          ? format(new Date(record.clockedOutAt), 'HH:mm')
                          : '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {record.regularHours ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            STATUS_COLORS[record.status] ?? 'neutral'
                          }
                        >
                          {record.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No attendance records found.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
