import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  FileText,
  Download,
  Mail,
  Eye,
  Calendar,
  Building,
  User,
} from 'lucide-react';
import { formatCurrency, PayrollResult } from '@/utils/payrollCalculations';

interface PayslipData {
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
  company: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  payroll: PayrollResult;
  period: {
    name: string;
    start_date: string;
    end_date: string;
    pay_date: string;
  };
  ytd?: PayrollResult;
}

interface PayslipGeneratorProps {
  data: PayslipData;
  onDownloadPDF?: () => void;
  onSendEmail?: () => void;
}

export default function PayslipGenerator({
  data,
  onDownloadPDF,
  onSendEmail,
}: PayslipGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownloadPDF = async () => {
    setIsGenerating(true);
    try {
      // Generate PDF using browser's print functionality
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(generatePrintableHTML());
        printWindow.document.close();
        printWindow.print();
      }
      onDownloadPDF?.();
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const generatePrintableHTML = () => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payslip - ${data.employee.first_name} ${data.employee.last_name}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
        .company-name { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
        .payslip-title { font-size: 18px; margin-top: 10px; }
        .employee-info { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .info-section { flex: 1; }
        .table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .table th, .table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .table th { background-color: #f5f5f5; font-weight: bold; }
        .total-row { font-weight: bold; background-color: #f9f9f9; }
        .net-pay { background-color: #e8f5e8; font-weight: bold; font-size: 16px; }
        .footer { margin-top: 30px; font-size: 12px; color: #666; }
        @media print { body { margin: 0; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-name">${data.company.name}</div>
        ${data.company.address ? `<div>${data.company.address}</div>` : ''}
        ${data.company.phone ? `<div>Tel: ${data.company.phone}</div>` : ''}
        <div class="payslip-title">PAYSLIP</div>
      </div>
      
      <div class="employee-info">
        <div class="info-section">
          <strong>Employee Details</strong><br>
          Name: ${data.employee.first_name} ${data.employee.last_name}<br>
          Employee No: ${data.employee.employee_number}<br>
          Department: ${data.employee.department}<br>
          Position: ${data.employee.job_title}
        </div>
        <div class="info-section">
          <strong>Pay Period</strong><br>
          Period: ${data.period.name}<br>
          From: ${new Date(data.period.start_date).toLocaleDateString()}<br>
          To: ${new Date(data.period.end_date).toLocaleDateString()}<br>
          Pay Date: ${new Date(data.period.pay_date).toLocaleDateString()}
        </div>
      </div>

      <table class="table">
        <thead>
          <tr>
            <th>EARNINGS</th>
            <th>AMOUNT (KES)</th>
            <th>DEDUCTIONS</th>
            <th>AMOUNT (KES)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Basic Salary</td>
            <td>${formatCurrency(data.payroll.basicSalary).replace('KES ', '')}</td>
            <td>PAYE Tax</td>
            <td>${formatCurrency(data.payroll.payeTax).replace('KES ', '')}</td>
          </tr>
          <tr>
            <td>Transport Allowance</td>
            <td>${formatCurrency(data.payroll.breakdown.transportAllowance).replace('KES ', '')}</td>
            <td>NSSF</td>
            <td>${formatCurrency(data.payroll.nssfEmployee).replace('KES ', '')}</td>
          </tr>
          <tr>
            <td>Housing Allowance</td>
            <td>${formatCurrency(data.payroll.breakdown.housingAllowance).replace('KES ', '')}</td>
            <td>NHIF</td>
            <td>${formatCurrency(data.payroll.nhifDeduction).replace('KES ', '')}</td>
          </tr>
          <tr>
            <td>Medical Allowance</td>
            <td>${formatCurrency(data.payroll.breakdown.medicalAllowance).replace('KES ', '')}</td>
            <td>SACCO</td>
            <td>${formatCurrency(data.payroll.breakdown.saccoDeduction).replace('KES ', '')}</td>
          </tr>
          <tr>
            <td>Overtime</td>
            <td>${formatCurrency(data.payroll.breakdown.overtimeAmount).replace('KES ', '')}</td>
            <td>HELB</td>
            <td>${formatCurrency(data.payroll.breakdown.helbDeduction).replace('KES ', '')}</td>
          </tr>
          <tr>
            <td>Commission</td>
            <td>${formatCurrency(data.payroll.breakdown.commissionAmount).replace('KES ', '')}</td>
            <td>Pension</td>
            <td>${formatCurrency(data.payroll.breakdown.pensionDeduction).replace('KES ', '')}</td>
          </tr>
          <tr>
            <td>Bonus</td>
            <td>${formatCurrency(data.payroll.breakdown.bonusAmount).replace('KES ', '')}</td>
            <td>Loans</td>
            <td>${formatCurrency(data.payroll.breakdown.loanDeductions).replace('KES ', '')}</td>
          </tr>
          <tr>
            <td>Other Allowances</td>
            <td>${formatCurrency(data.payroll.breakdown.otherAllowances).replace('KES ', '')}</td>
            <td>Other Deductions</td>
            <td>${formatCurrency(data.payroll.breakdown.otherDeductions).replace('KES ', '')}</td>
          </tr>
          <tr class="total-row">
            <td><strong>GROSS PAY</strong></td>
            <td><strong>${formatCurrency(data.payroll.totalGross).replace('KES ', '')}</strong></td>
            <td><strong>TOTAL DEDUCTIONS</strong></td>
            <td><strong>${formatCurrency(data.payroll.totalDeductions).replace('KES ', '')}</strong></td>
          </tr>
          <tr class="net-pay">
            <td colspan="3"><strong>NET PAY</strong></td>
            <td><strong>${formatCurrency(data.payroll.netPay).replace('KES ', '')}</strong></td>
          </tr>
        </tbody>
      </table>

      ${
        data.ytd
          ? `
      <table class="table">
        <thead>
          <tr>
            <th colspan="2">YEAR TO DATE SUMMARY</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>YTD Gross Pay</td>
            <td>${formatCurrency(data.ytd.totalGross).replace('KES ', '')}</td>
          </tr>
          <tr>
            <td>YTD PAYE Tax</td>
            <td>${formatCurrency(data.ytd.payeTax).replace('KES ', '')}</td>
          </tr>
          <tr>
            <td>YTD NSSF</td>
            <td>${formatCurrency(data.ytd.nssfEmployee).replace('KES ', '')}</td>
          </tr>
          <tr>
            <td>YTD NHIF</td>
            <td>${formatCurrency(data.ytd.nhifDeduction).replace('KES ', '')}</td>
          </tr>
          <tr class="total-row">
            <td><strong>YTD Net Pay</strong></td>
            <td><strong>${formatCurrency(data.ytd.netPay).replace('KES ', '')}</strong></td>
          </tr>
        </tbody>
      </table>
      `
          : ''
      }

      ${
        data.employee.bank_name
          ? `
      <div style="margin-top: 20px;">
        <strong>Payment Details:</strong><br>
        Bank: ${data.employee.bank_name}<br>
        Account: ${data.employee.bank_account || 'N/A'}
      </div>
      `
          : ''
      }

      <div class="footer">
        <p>This is a computer-generated payslip and does not require a signature.</p>
        <p>Generated on: ${new Date().toLocaleString()}</p>
      </div>
    </body>
    </html>
    `;
  };

  return (
    <div className="space-y-6">
      {/* Payslip Header */}
      <Card>
        <CardHeader className="text-center border-b">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">{data.company.name}</h1>
            {data.company.address && (
              <p className="text-muted-foreground">{data.company.address}</p>
            )}
            <h2 className="text-xl font-semibold">PAYSLIP</h2>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Employee Details */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <User className="h-4 w-4" />
                Employee Details
              </h3>
              <div className="space-y-1">
                <p>
                  <span className="font-medium">Name:</span>{' '}
                  {data.employee.first_name} {data.employee.last_name}
                </p>
                <p>
                  <span className="font-medium">Employee No:</span>{' '}
                  {data.employee.employee_number}
                </p>
                <p>
                  <span className="font-medium">Department:</span>{' '}
                  {data.employee.department}
                </p>
                <p>
                  <span className="font-medium">Position:</span>{' '}
                  {data.employee.job_title}
                </p>
              </div>
            </div>

            {/* Pay Period */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Pay Period
              </h3>
              <div className="space-y-1">
                <p>
                  <span className="font-medium">Period:</span>{' '}
                  {data.period.name}
                </p>
                <p>
                  <span className="font-medium">From:</span>{' '}
                  {new Date(data.period.start_date).toLocaleDateString()}
                </p>
                <p>
                  <span className="font-medium">To:</span>{' '}
                  {new Date(data.period.end_date).toLocaleDateString()}
                </p>
                <p>
                  <span className="font-medium">Pay Date:</span>{' '}
                  {new Date(data.period.pay_date).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Earnings and Deductions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Earnings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-green-700">Earnings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span>Basic Salary</span>
              <span className="font-medium">
                {formatCurrency(data.payroll.basicSalary)}
              </span>
            </div>
            {data.payroll.breakdown.transportAllowance > 0 && (
              <div className="flex justify-between">
                <span>Transport Allowance</span>
                <span className="font-medium">
                  {formatCurrency(data.payroll.breakdown.transportAllowance)}
                </span>
              </div>
            )}
            {data.payroll.breakdown.housingAllowance > 0 && (
              <div className="flex justify-between">
                <span>Housing Allowance</span>
                <span className="font-medium">
                  {formatCurrency(data.payroll.breakdown.housingAllowance)}
                </span>
              </div>
            )}
            {data.payroll.breakdown.medicalAllowance > 0 && (
              <div className="flex justify-between">
                <span>Medical Allowance</span>
                <span className="font-medium">
                  {formatCurrency(data.payroll.breakdown.medicalAllowance)}
                </span>
              </div>
            )}
            {data.payroll.breakdown.overtimeAmount > 0 && (
              <div className="flex justify-between">
                <span>Overtime</span>
                <span className="font-medium">
                  {formatCurrency(data.payroll.breakdown.overtimeAmount)}
                </span>
              </div>
            )}
            {data.payroll.breakdown.commissionAmount > 0 && (
              <div className="flex justify-between">
                <span>Commission</span>
                <span className="font-medium">
                  {formatCurrency(data.payroll.breakdown.commissionAmount)}
                </span>
              </div>
            )}
            {data.payroll.breakdown.bonusAmount > 0 && (
              <div className="flex justify-between">
                <span>Bonus</span>
                <span className="font-medium">
                  {formatCurrency(data.payroll.breakdown.bonusAmount)}
                </span>
              </div>
            )}
            {data.payroll.breakdown.otherAllowances > 0 && (
              <div className="flex justify-between">
                <span>Other Allowances</span>
                <span className="font-medium">
                  {formatCurrency(data.payroll.breakdown.otherAllowances)}
                </span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>Gross Pay</span>
              <span className="text-green-700">
                {formatCurrency(data.payroll.totalGross)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Deductions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-red-700">Deductions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span>PAYE Tax</span>
              <span className="font-medium">
                {formatCurrency(data.payroll.payeTax)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>NSSF</span>
              <span className="font-medium">
                {formatCurrency(data.payroll.nssfEmployee)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>NHIF</span>
              <span className="font-medium">
                {formatCurrency(data.payroll.nhifDeduction)}
              </span>
            </div>
            {data.payroll.breakdown.saccoDeduction > 0 && (
              <div className="flex justify-between">
                <span>SACCO</span>
                <span className="font-medium">
                  {formatCurrency(data.payroll.breakdown.saccoDeduction)}
                </span>
              </div>
            )}
            {data.payroll.breakdown.helbDeduction > 0 && (
              <div className="flex justify-between">
                <span>HELB</span>
                <span className="font-medium">
                  {formatCurrency(data.payroll.breakdown.helbDeduction)}
                </span>
              </div>
            )}
            {data.payroll.breakdown.pensionDeduction > 0 && (
              <div className="flex justify-between">
                <span>Pension</span>
                <span className="font-medium">
                  {formatCurrency(data.payroll.breakdown.pensionDeduction)}
                </span>
              </div>
            )}
            {data.payroll.breakdown.loanDeductions > 0 && (
              <div className="flex justify-between">
                <span>Loans</span>
                <span className="font-medium">
                  {formatCurrency(data.payroll.breakdown.loanDeductions)}
                </span>
              </div>
            )}
            {data.payroll.breakdown.otherDeductions > 0 && (
              <div className="flex justify-between">
                <span>Other Deductions</span>
                <span className="font-medium">
                  {formatCurrency(data.payroll.breakdown.otherDeductions)}
                </span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>Total Deductions</span>
              <span className="text-red-700">
                {formatCurrency(data.payroll.totalDeductions)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Net Pay */}
      <Card className="bg-green-50 border-green-200">
        <CardContent className="pt-6">
          <div className="flex justify-between items-center text-2xl font-bold">
            <span>Net Pay</span>
            <span className="text-green-700">
              {formatCurrency(data.payroll.netPay)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Year to Date Summary */}
      {data.ytd && (
        <Card>
          <CardHeader>
            <CardTitle>Year to Date Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">YTD Gross</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(data.ytd.totalGross)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">YTD PAYE</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(data.ytd.payeTax)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">YTD NSSF</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(data.ytd.nssfEmployee)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">YTD Net</p>
                <p className="text-lg font-semibold text-green-700">
                  {formatCurrency(data.ytd.netPay)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Details */}
      {data.employee.bank_name && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Payment Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Bank</p>
                <p className="font-medium">{data.employee.bank_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Account Number</p>
                <p className="font-medium">
                  {data.employee.bank_account || 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-4">
        <Button onClick={handleDownloadPDF} disabled={isGenerating}>
          <Download className="mr-2 h-4 w-4" />
          {isGenerating ? 'Generating...' : 'Download PDF'}
        </Button>
        <Button variant="outline" onClick={onSendEmail}>
          <Mail className="mr-2 h-4 w-4" />
          Email Payslip
        </Button>
        <Button variant="outline">
          <Eye className="mr-2 h-4 w-4" />
          Preview
        </Button>
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-muted-foreground border-t pt-4">
        <p>
          This is a computer-generated payslip and does not require a signature.
        </p>
        <p>Generated on: {new Date().toLocaleString()}</p>
      </div>
    </div>
  );
}
