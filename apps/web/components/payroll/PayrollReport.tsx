import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Download,
  FileText,
  Mail,
  Calendar,
  TrendingUp,
  Users,
  DollarSign,
  Building,
} from 'lucide-react';
import { formatCurrency } from '@/utils/payrollCalculations';

interface PayrollSummary {
  period: string;
  employees_count: number;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  paye_total: number;
  nssf_total: number;
  nhif_total: number;
}

interface StatutoryReport {
  type: 'PAYE' | 'NSSF' | 'NHIF';
  period: string;
  due_date: string;
  total_amount: number;
  status: 'pending' | 'submitted' | 'paid';
  submission_reference?: string;
}

interface PayrollReportsProps {
  summaries?: PayrollSummary[];
  statutoryReports?: StatutoryReport[];
  onGenerateReport?: (type: string, period: string) => void;
  onExportData?: (format: string, data: any) => void;
}

export default function PayrollReports({
  summaries = [],
  statutoryReports = [],
  onGenerateReport,
  onExportData,
}: PayrollReportsProps) {
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [reportType, setReportType] = useState('summary');
  const [exportFormat, setExportFormat] = useState('pdf');

  const mockSummaries: PayrollSummary[] = [
    {
      period: '2024-12',
      employees_count: 45,
      total_gross: 2850000,
      total_deductions: 850000,
      total_net: 2000000,
      paye_total: 450000,
      nssf_total: 180000,
      nhif_total: 67500,
    },
    {
      period: '2024-11',
      employees_count: 43,
      total_gross: 2750000,
      total_deductions: 825000,
      total_net: 1925000,
      paye_total: 435000,
      nssf_total: 175000,
      nhif_total: 64500,
    },
  ];

  const mockStatutoryReports: StatutoryReport[] = [
    {
      type: 'PAYE',
      period: '2024-12',
      due_date: '2025-01-09',
      total_amount: 450000,
      status: 'pending',
    },
    {
      type: 'NSSF',
      period: '2024-12',
      due_date: '2025-01-15',
      total_amount: 180000,
      status: 'pending',
    },
    {
      type: 'NHIF',
      period: '2024-12',
      due_date: '2025-01-15',
      total_amount: 67500,
      status: 'submitted',
      submission_reference: 'NHIF-2024-12-001',
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-800">Paid</Badge>;
      case 'submitted':
        return <Badge className="bg-blue-100 text-blue-800">Submitted</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
    }
  };

  const handleGenerateReport = () => {
    onGenerateReport?.(reportType, selectedPeriod);
  };

  const handleExport = (format: string) => {
    const data =
      reportType === 'summary' ? mockSummaries : mockStatutoryReports;
    onExportData?.(format, data);
  };

  return (
    <div className="space-y-6">
      {/* Report Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Generate Reports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reportType">Report Type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="summary">Payroll Summary</SelectItem>
                  <SelectItem value="detailed">Detailed Payroll</SelectItem>
                  <SelectItem value="statutory">Statutory Returns</SelectItem>
                  <SelectItem value="ytd">Year-to-Date</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="period">Period</Label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024-12">December 2024</SelectItem>
                  <SelectItem value="2024-11">November 2024</SelectItem>
                  <SelectItem value="2024-10">October 2024</SelectItem>
                  <SelectItem value="2024-q4">Q4 2024</SelectItem>
                  <SelectItem value="2024">Year 2024</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="format">Export Format</Label>
              <Select value={exportFormat} onValueChange={setExportFormat}>
                <SelectTrigger>
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="excel">Excel</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-4">
            <Button onClick={handleGenerateReport}>
              <FileText className="mr-2 h-4 w-4" />
              Generate Report
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport(exportFormat)}
            >
              <Download className="mr-2 h-4 w-4" />
              Export {exportFormat.toUpperCase()}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="summaries" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="summaries">Payroll Summaries</TabsTrigger>
          <TabsTrigger value="statutory">Statutory Returns</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="summaries" className="space-y-6">
          {/* Summary Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Employees
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">45</div>
                <p className="text-xs text-muted-foreground">
                  +2 from last month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Gross Pay
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(2850000)}
                </div>
                <p className="text-xs text-muted-foreground">
                  +3.6% from last month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Deductions
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(850000)}
                </div>
                <p className="text-xs text-muted-foreground">29.8% of gross</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Net Pay</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(2000000)}
                </div>
                <p className="text-xs text-muted-foreground">70.2% of gross</p>
              </CardContent>
            </Card>
          </div>

          {/* Payroll Summaries Table */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Payroll Summaries</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Employees</TableHead>
                    <TableHead>Gross Pay</TableHead>
                    <TableHead>PAYE</TableHead>
                    <TableHead>NSSF</TableHead>
                    <TableHead>NHIF</TableHead>
                    <TableHead>Total Deductions</TableHead>
                    <TableHead>Net Pay</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockSummaries.map((summary) => (
                    <TableRow key={summary.period}>
                      <TableCell className="font-medium">
                        {summary.period}
                      </TableCell>
                      <TableCell>{summary.employees_count}</TableCell>
                      <TableCell>
                        {formatCurrency(summary.total_gross)}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(summary.paye_total)}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(summary.nssf_total)}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(summary.nhif_total)}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(summary.total_deductions)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(summary.total_net)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline">
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statutory" className="space-y-6">
          {/* Compliance Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">PAYE Returns</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(450000)}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className="bg-yellow-100 text-yellow-800">
                    Due Jan 9
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">NSSF Contributions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(180000)}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className="bg-yellow-100 text-yellow-800">
                    Due Jan 15
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">NHIF Remittance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(67500)}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className="bg-blue-100 text-blue-800">Submitted</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Statutory Reports Table */}
          <Card>
            <CardHeader>
              <CardTitle>Statutory Returns</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockStatutoryReports.map((report, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {report.type}
                      </TableCell>
                      <TableCell>{report.period}</TableCell>
                      <TableCell>
                        {formatCurrency(report.total_amount)}
                      </TableCell>
                      <TableCell>
                        {new Date(report.due_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{getStatusBadge(report.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {report.submission_reference || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <Download className="h-4 w-4" />
                          </Button>
                          {report.status === 'pending' && (
                            <Button size="sm">Submit</Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Payroll Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Payroll Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Average Monthly Gross</span>
                    <span className="font-medium">
                      {formatCurrency(2800000)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Average Deduction Rate</span>
                    <span className="font-medium">29.8%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Highest Department Cost</span>
                    <span className="font-medium">Engineering</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Employee Growth Rate</span>
                    <span className="font-medium text-green-600">+4.7%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Deduction Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Deduction Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded"></div>
                      <span className="text-sm">PAYE Tax</span>
                    </div>
                    <span className="font-medium">52.9%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded"></div>
                      <span className="text-sm">NSSF</span>
                    </div>
                    <span className="font-medium">21.2%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded"></div>
                      <span className="text-sm">NHIF</span>
                    </div>
                    <span className="font-medium">7.9%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                      <span className="text-sm">Other</span>
                    </div>
                    <span className="font-medium">18.0%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
