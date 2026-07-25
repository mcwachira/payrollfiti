'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  User,
  FileText,
  Calendar,
  CreditCard,
  AlertTriangle,
  Download,
} from 'lucide-react';
import { Employee } from '@/types/types';
import { EmployeeProfile } from '../employees/EmployeeProfile';
import LeaveBalance from './LeaveBalance';
import LeaveApplication from './LeaveApplication';
import { useAuth } from '@/contexts/AuthContext';
import { getEmployee, toEmployeeListItem } from '@/lib/employees-api';
import {
  getMyPayrollEntries,
  downloadPayslip,
  type MyPayrollEntry,
} from '@/lib/payroll-api';
import { ApiError } from '@/lib/api-client';
import { fetchWithOfflineCache } from '@/lib/offline/offline-cache';
import { useResyncOnReconnect } from '@/lib/offline/use-resync-on-reconnect';
import { OfflineDataBanner } from '@/components/offline/OfflineDataBanner';

export default function EmployeeSelfService() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [payslips, setPayslips] = useState<MyPayrollEntry[]>([]);
  const [payslipsError, setPayslipsError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [offlineCachedAt, setOfflineCachedAt] = useState<number | null>(null);

  // Guards every setState below against firing after unmount — load() also
  // runs from useResyncOnReconnect, outside the mount effect below, so a
  // plain effect-cleanup `cancelled` flag scoped to one call wouldn't cover it.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setOfflineCachedAt(null);
    try {
      if (!user?.employeeId) {
        throw new Error(
          'This account is not linked to an employee profile. Please contact HR.',
        );
      }
      const employeeId = user.employeeId;

      const profileResult = await fetchWithOfflineCache(
        `profile:${employeeId}`,
        () => getEmployee(employeeId),
      );
      if (!isMountedRef.current) return;
      setEmployee(toEmployeeListItem(profileResult.data) as Employee);
      if (profileResult.fromCache) setOfflineCachedAt(profileResult.cachedAt ?? Date.now());

      try {
        const payslipsResult = await fetchWithOfflineCache(
          `payslips:${employeeId}`,
          () => getMyPayrollEntries(),
        );
        if (isMountedRef.current) {
          setPayslips(payslipsResult.data);
          setPayslipsError(null);
          if (payslipsResult.fromCache) {
            setOfflineCachedAt((prev) => prev ?? payslipsResult.cachedAt ?? Date.now());
          }
        }
      } catch (payslipErr) {
        if (isMountedRef.current) {
          setPayslipsError(
            payslipErr instanceof ApiError
              ? payslipErr.message
              : 'Failed to load payslips',
          );
        }
      }
    } catch (err) {
      if (isMountedRef.current)
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load employee profile',
        );
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [user?.employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  // "Sync when online": silently refetches and re-caches the moment
  // connectivity returns, so cached data shown while offline doesn't go
  // stale any longer than necessary.
  useResyncOnReconnect(load);

  const handleDownloadPayslip = async (entryId: string) => {
    setDownloadingId(entryId);
    try {
      await downloadPayslip(entryId);
    } catch (err) {
      setPayslipsError(
        err instanceof ApiError ? err.message : 'Failed to download payslip',
      );
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
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
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            <p>{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!employee) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Employee profile not found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {offlineCachedAt !== null && (
        <OfflineDataBanner cachedAt={offlineCachedAt} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Employee Portal</h1>
          <p className="text-muted-foreground">
            Welcome, {employee.first_name} {employee.last_name}
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {employee.employment_status || 'active'}
        </Badge>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Employee ID</p>
                <p className="font-semibold">{employee.employee_number}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Job Title</p>
                <p className="font-semibold">{employee.job_title ?? '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">Hire Date</p>
                <p className="font-semibold">
                  {employee.hire_date
                    ? new Date(employee.hire_date).toLocaleDateString()
                    : 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-orange-600" />
              <div>
                <p className="text-sm text-muted-foreground">Payslips</p>
                <p className="font-semibold">{payslips.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="profile">My Profile</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="payslips">Payslips</TabsTrigger>
          <TabsTrigger value="applications">Applications</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <EmployeeProfile employee={employee} onClose={() => {}} />
        </TabsContent>

        <TabsContent value="leave" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LeaveBalance employeeId={employee.id} />
            <LeaveApplication employeeId={employee.id} />
          </div>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          {/*<EmployeeDocuments employeeId={employee.id} />*/}
        </TabsContent>

        <TabsContent value="payslips" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>My Payslips</CardTitle>
              <CardDescription>View and download your payslips</CardDescription>
            </CardHeader>
            <CardContent>
              {payslipsError ? (
                <p className="text-red-600">{payslipsError}</p>
              ) : payslips.length > 0 ? (
                <div className="space-y-2">
                  {payslips.map((payslip) => (
                    <div
                      key={payslip.id}
                      className="flex items-center justify-between p-3 border rounded"
                    >
                      <div>
                        <p className="font-medium">
                          {payslip.payrollRun.period}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Net Pay: {payslip.currency}{' '}
                          {payslip.netPay.toLocaleString()}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={downloadingId === payslip.id}
                        onClick={() => handleDownloadPayslip(payslip.id)}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        {downloadingId === payslip.id
                          ? 'Downloading…'
                          : 'Download'}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">
                  No payslips available yet
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="applications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>My Applications</CardTitle>
              <CardDescription>
                Track your leave applications and other requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Feature coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
