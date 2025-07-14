'use client';

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
import { Textarea } from '@/components/ui/textarea';
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
  Upload,
  CheckCircle,
  AlertTriangle,
  Building,
  CreditCard,
  FileText,
} from 'lucide-react';
import { formatCurrency } from '@/utils/payrollCalculations';

interface BankFileEntry {
  employee_id: string;
  employee_name: string;
  employee_number: string;
  account_number: string;
  bank_name: string;
  bank_code?: string;
  branch_code?: string;
  amount: number;
  reference: string;
  status: 'pending' | 'included' | 'excluded' | 'error';
  error_message?: string;
}

interface BankFileGeneratorProps {
  payrollPeriodId: string;
  entries: BankFileEntry[];
  onGenerateFile?: (format: string, entries: BankFileEntry[]) => void;
  onUploadFile?: (file: File) => void;
}

const BankFileGenerator = ({
  payrollPeriodId,
  entries,
  onGenerateFile,
  onUploadFile,
}: BankFileGeneratorProps) => {
  const [bankFormat, setBankFormat] = useState('');
  const [companyAccount, setCompanyAccount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [narration, setNarration] = useState('');
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);

  const mockEntries: BankFileEntry[] = [
    {
      employee_id: '1',
      employee_name: 'John Doe',
      employee_number: 'EMP001',
      account_number: '1234567890',
      bank_name: 'Equity Bank',
      bank_code: '068',
      branch_code: '068001',
      amount: 85000,
      reference: 'SAL-2024-12-001',
      status: 'included',
    },
    {
      employee_id: '2',
      employee_name: 'Jane Smith',
      employee_number: 'EMP002',
      account_number: '0987654321',
      bank_name: 'KCB Bank',
      bank_code: '001',
      branch_code: '001001',
      amount: 95000,
      reference: 'SAL-2024-12-002',
      status: 'included',
    },
    {
      employee_id: '3',
      employee_name: 'Mike Johnson',
      employee_number: 'EMP003',
      account_number: '',
      bank_name: '',
      amount: 75000,
      reference: 'SAL-2024-12-003',
      status: 'error',
      error_message: 'Missing bank details',
    },
  ];

  const validEntries = mockEntries.filter(
    (entry) => entry.stat === 'included' || entry.status === 'pending',
  );
  const errorEntries = mockEntries.filter((entry) => entry.status === 'error');
  const totalAmount = validEntries.reduce(
    (sum, entry) => sum + entry.amount,
    0,
  );

  const handleGenerateFile = () => {
    if (!bankFormat || !companyAccount || !paymentDate) {
      return;
    }

    const entriesToInclude = validEntries.filter(
      (entry) =>
        selectedEntries.length === 0 ||
        selectedEntries.includes(entry.employee_id),
    );

    onGenerateFile?.(bankFormat, entriesToInclude);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onUploadFile) {
      onUploadFile(file);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'included':
        return <Badge className="bg-green-100 text-green-800">Included</Badge>;
      case 'excluded':
        return <Badge variant="outline">Excluded</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800">Error</Badge>;
      default:
        return <Badge className="bg-blue-100 text-blue-800">Pending</Badge>;
    }
  };
return (
    <div className="space-y-6">
      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Bank File Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bankFormat">Bank Format</Label>
              <Select value={bankFormat} onValueChange={setBankFormat}>
                <SelectTrigger>
                  <SelectValue placeholder="Select bank format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equity">Equity Bank CSV</SelectItem>
                  <SelectItem value="kcb">KCB Bank Excel</SelectItem>
                  <SelectItem value="coop">Co-operative Bank CSV</SelectItem>
                  <SelectItem value="dtb">DTB Bank Fixed Width</SelectItem>
                  <SelectItem value="standard">Standard Bank CSV</SelectItem>
                  <SelectItem value="generic">Generic CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyAccount">Company Account Number</Label>
              <Input
                id="companyAccount"
                value={companyAccount}
                onChange={(e) => setCompanyAccount(e.target.value)}
                placeholder="Enter company account number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentDate">Payment Date</Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentReference">Payment Reference</Label>
              <Input
                id="paymentReference"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="e.g., SALARY-DEC-2024"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="narration">Payment Narration</Label>
            <Textarea
              id="narration"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder="Enter payment description"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockEntries.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valid Entries</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{validEntries.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{errorEntries.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalAmount)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button 
              onClick={handleGenerateFile}
              disabled={!bankFormat || !companyAccount || !paymentDate || validEntries.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Generate Bank File
            </Button>
            
            <Button variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              Preview File
            </Button>
            
            <div className="relative">
              <input
                type="file"
                accept=".csv,.xlsx,.txt"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Upload Confirmation
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Entries */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Account Details</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockEntries.map((entry) => (
                <TableRow key={entry.employee_id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{entry.employee_name}</p>
                      <p className="text-sm text-muted-foreground">{entry.employee_number}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{entry.account_number || 'N/A'}</p>
                      {entry.branch_code && (
                        <p className="text-sm text-muted-foreground">Branch: {entry.branch_code}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{entry.bank_name || 'N/A'}</p>
                      {entry.bank_code && (
                        <p className="text-sm text-muted-foreground">Code: {entry.bank_code}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(entry.amount)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {entry.reference}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(entry.status)}
                    {entry.error_message && (
                      <p className="text-xs text-red-600 mt-1">{entry.error_message}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {entry.status === 'error' && (
                        <Button size="sm" variant="outline">
                          Fix
                        </Button>
                      )}
                      {entry.status === 'included' && (
                        <Button size="sm" variant="outline">
                          Exclude
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

      {/* Bank File Formats Info */}
      <Card>
        <CardHeader>
          <CardTitle>Supported Bank Formats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">CSV Formats</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Equity Bank CSV</li>
                <li>• Co-operative Bank CSV</li>
                <li>• Standard Bank CSV</li>
                <li>• Generic CSV</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Fixed Width Formats</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• DTB Bank Fixed Width</li>
                <li>• KCB Bank Excel</li>
                <li>• Custom formats available</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
;
