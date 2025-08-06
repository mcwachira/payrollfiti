'use client';
import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  User,
  FileText,
  Calendar,
  CreditCard,
  AlertTriangle,
} from 'lucide-react';
import { Employee } from '@/types/types';
import { EmployeeProfile } from '../employees/EmployeeProfile';
import LeaveBalance from './LeaveBalance';
import LeaveApplication from './LeaveApplication';

type Payslip = {
  id: number;
  employee_id: number;
  month: string;
  basic_salary: number;
  allowances: number;
  deductions: number;
  net_pay: number;
  created_at: string;
};

// Sample authenticated user (normally from Supabase)
const mockUser = {
  email: 'john.doe@example.com',
};

// Sample employee
const sampleEmployees: Employee[] = [
  {
    id: 1,
    name: 'John Doe',
    email: 'john.doe@example.com',
    department: 'Engineering',
    position: 'Software Engineer',
  },
];

// Sample payslips
const samplePayslips: Payslip[] = [
  {
    id: 101,
    employee_id: 1,
    month: 'Jul 2025',
    basic_salary: 120000,
    allowances: 20000,
    deductions: 5000,
    net_pay: 135000,
    created_at: '2025-07-31T00:00:00Z',
  },
  {
    id: 102,
    employee_id: 1,
    month: 'Jun 2025',
    basic_salary: 120000,
    allowances: 15000,
    deductions: 4000,
    net_pay: 131000,
    created_at: '2025-06-30T00:00:00Z',
  },
];

export default function EmployeeSelfService() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);

  useEffect(() => {
    fetchEmployeeData();
  }, []);

  const fetchEmployeeData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Simulate auth user (in real app you'd use Supabase auth)
      const userEmail = mockUser.email;
      if (!userEmail) throw new Error('User not authenticated');

      // Simulate fetching employee data
      const employeeData = sampleEmployees.find(
        (emp) => emp.email === userEmail,
      );
      if (!employeeData) {
        throw new Error('Employee profile not found. Please contact HR.');
      }
      setEmployee(employeeData);

      // Simulate fetching payslips
      const payslipData = samplePayslips.filter(
        (ps) => ps.employee_id === employeeData.id,
      );
      setPayslips(payslipData);
    } catch (error: any) {
      console.error('Error:', error.message);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="text-red-600">Error: {error}</p>;

  const handleProfileUpdate = async (data) => {
    if (!employee) return;
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
                <p className="text-sm text-muted-foreground">Basic Salary</p>
                <p className="font-semibold">
                  KES {employee.basic_salary?.toLocaleString()}
                </p>
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
          <EmployeeProfile employee={employee} onUpdate={handleProfileUpdate} />
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
              {payslips.length > 0 ? (
                <div className="space-y-2">
                  {payslips.map((payslip) => (
                    <div
                      key={payslip.id}
                      className="flex items-center justify-between p-3 border rounded"
                    >
                      <div>
                        <p className="font-medium">{payslip.period}</p>
                        <p className="text-sm text-muted-foreground">
                          Net Pay: KES {payslip.net_pay.toLocaleString()}
                        </p>
                      </div>
                      {payslip.payslip_url && (
                        <a
                          href={payslip.payslip_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          View Payslip
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No payslips available</p>
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
