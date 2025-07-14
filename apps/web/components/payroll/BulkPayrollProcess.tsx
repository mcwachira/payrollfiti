'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Play,
  Pause,
  Download,
  Mail,
  CheckCircle,
  AlertCircle,
  Users,
  Calculator,
} from 'lucide-react';
import { formatCurrency } from '@/utils/payrollCalculations';

interface BulkPayrollItem {
  employee_id: string;
  employee_number: string;
  employee_name: string;
  department: string;
  basic_salary: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error_message?: string;
  net_pay?: number;
  gross_pay?: number;
}

interface BulkPayrollProcessorProps {
  payrollPeriodId: string;
  employees: BulkPayrollItem[];
  onProcess?: (employeeIds: string[]) => Promise<void>;
  onGenerateReports?: () => void;
  onSendPayslips?: (employeeIds: string[]) => void;
}

function BulkPayrollProcessor({
  payrollPeriodId,
  employees,
  onProcess,
  onGenerateReports,
  onSendPayslips,
}: BulkPayrollProcessorProps) {
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEmployees(employees.map((emp) => emp.employee_id));
    } else {
      setSelectedEmployees([]);
    }
  };

  const handleSelectEmployee = (employeeId: string, checked: boolean) => {
    if (checked) {
      setSelectedEmployees((prev) => [...prev, employeeId]);
    } else {
      setSelectedEmployees((prev) => prev.filter((id) => id !== employeeId));
    }
  };

  const handleBulkProcess = async () => {
    if (!onProcess || selectedEmployees.length === 0) return;

    setIsProcessing(true);
    setProgress(0);
    setProcessedCount(0);

    try {
      // Simulate processing with progress updates
      const total = selectedEmployees.length;
      for (let i = 0; i < total; i++) {
        // Process employee
        await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate processing time
        setProcessedCount(i + 1);
        setProgress(((i + 1) / total) * 100);
      }

      await onProcess(selectedEmployees);
    } catch (error) {
      console.error('Bulk processing error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800">Processing</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800">Error</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  const completedEmployees = employees.filter(
    (emp) => emp.status === 'completed',
  );
  const errorEmployees = employees.filter((emp) => emp.status === 'error');
  const totalGrossPay = completedEmployees.reduce(
    (sum, emp) => sum + (emp.gross_pay || 0),
    0,
  );
  const totalNetPay = completedEmployees.reduce(
    (sum, emp) => sum + (emp.net_pay || 0),
    0,
  );
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Employees
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employees.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {completedEmployees.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Gross Pay
            </CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalGrossPay)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Net Pay</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalNetPay)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Processing Progress */}
      {isProcessing && (
        <Card>
          <CardHeader>
            <CardTitle>Processing Payroll</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progress} className="w-full" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                Processing {processedCount} of {selectedEmployees.length}{' '}
                employees
              </span>
              <span>{Math.round(progress)}% complete</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Bulk Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button
              onClick={handleBulkProcess}
              disabled={selectedEmployees.length === 0 || isProcessing}
            >
              {isProcessing ? (
                <>
                  <Pause className="mr-2 h-4 w-4" />
                  Processing...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Process Selected ({selectedEmployees.length})
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={() =>
                onSendPayslips?.(
                  completedEmployees.map((emp) => emp.employee_id),
                )
              }
              disabled={completedEmployees.length === 0}
            >
              <Mail className="mr-2 h-4 w-4" />
              Send Payslips ({completedEmployees.length})
            </Button>

            <Button
              variant="outline"
              onClick={onGenerateReports}
              disabled={completedEmployees.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Generate Reports
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Employee List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Employees</CardTitle>
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={selectedEmployees.length === employees.length}
                onCheckedChange={handleSelectAll}
              />
              <label className="text-sm font-medium">Select All</label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Select</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Basic Salary</TableHead>
                <TableHead>Gross Pay</TableHead>
                <TableHead>Net Pay</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.employee_id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedEmployees.includes(employee.employee_id)}
                      onCheckedChange={(checked) =>
                        handleSelectEmployee(
                          employee.employee_id,
                          checked as boolean,
                        )
                      }
                      disabled={employee.status === 'processing'}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(employee.status)}
                      <div>
                        <p className="font-medium">{employee.employee_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {employee.employee_number}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{employee.department}</TableCell>
                  <TableCell>{formatCurrency(employee.basic_salary)}</TableCell>
                  <TableCell>
                    {employee.gross_pay
                      ? formatCurrency(employee.gross_pay)
                      : '-'}
                  </TableCell>
                  <TableCell>
                    {employee.net_pay ? formatCurrency(employee.net_pay) : '-'}
                  </TableCell>
                  <TableCell>{getStatusBadge(employee.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {employee.status === 'completed' && (
                        <>
                          <Button size="sm" variant="outline">
                            View
                          </Button>
                          <Button size="sm" variant="outline">
                            Email
                          </Button>
                        </>
                      )}
                      {employee.status === 'error' && (
                        <Button size="sm" variant="outline">
                          Retry
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Error Summary */}
      {errorEmployees.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-800">Processing Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {errorEmployees.map((employee) => (
                <div
                  key={employee.employee_id}
                  className="flex items-center justify-between p-3 bg-red-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{employee.employee_name}</p>
                    <p className="text-sm text-red-600">
                      {employee.error_message}
                    </p>
                  </div>
                  <Button size="sm" variant="outline">
                    Retry
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
export default BulkPayrollProcessor;
