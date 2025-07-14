import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Download,
  Mail,
  Search,
  Calendar,
  User,
  Eye,
} from 'lucide-react';

import {
  formatCurrency,
  calculateYTD,
  PayrollResult,
} from '@/utils/payrollCalculations';
import { toast } from 'sonner';

interface PayslipRecord {
  id: string;
  employee: {
    id: string;
    employee_number: string;
    first_name: string;
    last_name: string;
    job_title: string;
    department: string;
    email: string;
    bank_name?: string;
    bank_account?: string;
  };
  period: {
    name: string;
    start_date: string;
    end_date: string;
    pay_date: string;
  };
  payroll_calculation: PayrollResult;
  created_at: string;
  status: 'draft' | 'approved' | 'sent';
}

interface PayslipViewerProps {
  payslipUrl?: string;
}

export default function PayslipViewer({ payslipUrl }: PayslipViewerProps) {
  const [payslips, setPayslips] = useState<PayslipRecord[]>([]);
  const [selectedPayslip, setSelectedPayslip] = useState<PayslipRecord | null>(
    null,
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showGenerator, setShowGenerator] = useState(false);

  useEffect(() => {
    fetchPayslips();
  }, []);

  // If payslipUrl is provided, show the PDF viewer
  if (payslipUrl) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Payslip Viewer</CardTitle>
        </CardHeader>
        <CardContent>
          {payslipUrl ? (
            <div className="w-full h-96">
              <iframe
                src={payslipUrl}
                className="w-full h-full border rounded"
                title="Payslip PDF"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No payslip URL provided</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const fetchPayslips = async () => {
    setIsLoading(true);
    try {
      // Mock data for now - in real app, fetch from Supabase
      const mockPayslips: PayslipRecord[] = [
        {
          id: '1',
          employee: {
            id: '1',
            employee_number: 'EMP001',
            first_name: 'John',
            last_name: 'Doe',
            job_title: 'Software Engineer',
            department: 'Engineering',
            email: 'john.doe@company.com',
            bank_name: 'Equity Bank',
            bank_account: '1234567890',
          },
          period: {
            name: 'December 2024',
            start_date: '2024-12-01',
            end_date: '2024-12-31',
            pay_date: '2024-12-30',
          },
          payroll_calculation: {
            basicSalary: 120000,
            totalAllowances: 25000,
            grossTaxable: 145000,
            grossNonTaxable: 0,
            totalGross: 145000,
            payeTax: 18500,
            nssfEmployee: 2400,
            nssfEmployer: 2400,
            nhifDeduction: 1700,
            totalStatutoryDeductions: 22600,
            totalVoluntaryDeductions: 5000,
            totalDeductions: 27600,
            netPay: 117400,
            breakdown: {
              transportAllowance: 15000,
              housingAllowance: 10000,
              medicalAllowance: 0,
              overtimeAmount: 0,
              commissionAmount: 0,
              bonusAmount: 0,
              otherAllowances: 0,
              saccoDeduction: 5000,
              helbDeduction: 0,
              pensionDeduction: 0,
              loanDeductions: 0,
              otherDeductions: 0,
            },
          },
          created_at: '2024-12-30T10:00:00Z',
          status: 'approved',
        },
      ];

      setPayslips(mockPayslips);
    } catch (error) {
      console.error('Error fetching payslips:', error);
      toast({
        title: 'Error',
        description: 'Failed to load payslips',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewPayslip = (payslip: PayslipRecord) => {
    setSelectedPayslip(payslip);
    setShowGenerator(true);
  };

  const handleSendEmail = async (payslip: PayslipRecord) => {
    try {
      // Simulate email sending
      toast({
        title: 'Email Sent',
        description: `Payslip sent to ${payslip.employee.email}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send email',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case 'sent':
        return <Badge className="bg-blue-100 text-blue-800">Sent</Badge>;
      default:
        return <Badge variant="outline">Draft</Badge>;
    }
  };

  const filteredPayslips = payslips.filter((payslip) => {
    const matchesSearch =
      payslip.employee.first_name
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      payslip.employee.last_name
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      payslip.employee.employee_number
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchesPeriod =
      !selectedPeriod || payslip.period.name.includes(selectedPeriod);
    return matchesSearch && matchesPeriod;
  });

  if (showGenerator && selectedPayslip) {
    const payslipData = {
      employee: selectedPayslip.employee,
      company: {
        name: 'Your Company Name',
        address: 'Company Address',
        phone: 'Company Phone',
        email: 'company@email.com',
      },
      payroll: selectedPayslip.payroll_calculation,
      period: selectedPayslip.period,
      ytd: undefined, // Would calculate YTD here
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => setShowGenerator(false)}>
            ← Back to Payslips
          </Button>
        </div>
        <PayslipGenerator
          data={payslipData}
          onSendEmail={() => handleSendEmail(selectedPayslip)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Payslip Manager</h1>
          <p className="text-muted-foreground">
            View and manage employee payslips
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All periods" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All periods</SelectItem>
                <SelectItem value="December 2024">December 2024</SelectItem>
                <SelectItem value="November 2024">November 2024</SelectItem>
                <SelectItem value="October 2024">October 2024</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Payslips List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPayslips.map((payslip) => (
          <Card key={payslip.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {payslip.employee.first_name} {payslip.employee.last_name}
                </CardTitle>
                {getStatusBadge(payslip.status)}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>{payslip.employee.employee_number}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{payslip.period.name}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {payslip.employee.department} • {payslip.employee.job_title}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Gross Pay:</span>
                  <span className="font-medium">
                    {formatCurrency(payslip.payroll_calculation.totalGross)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Deductions:</span>
                  <span className="font-medium text-red-600">
                    -
                    {formatCurrency(
                      payslip.payroll_calculation.totalDeductions,
                    )}
                  </span>
                </div>
                <div className="flex justify-between font-medium text-green-700 border-t pt-2">
                  <span>Net Pay:</span>
                  <span>
                    {formatCurrency(payslip.payroll_calculation.netPay)}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => handleViewPayslip(payslip)}
                >
                  <Eye className="mr-1 h-3 w-3" />
                  View
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSendEmail(payslip)}
                >
                  <Mail className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="outline">
                  <Download className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredPayslips.length === 0 && !isLoading && (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No payslips found</h3>
            <p className="text-muted-foreground">
              {searchTerm || selectedPeriod
                ? 'Try adjusting your search filters'
                : 'Payslips will appear here once generated'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
