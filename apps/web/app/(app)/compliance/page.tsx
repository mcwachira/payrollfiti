'use client';
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  FileText,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Send,
  Building,
  DollarSign,
  TrendingUp,
  Bell,
} from 'lucide-react';
import { formatCurrency } from '@/utils/payrollCalculations';
import { toast } from 'sonner';

interface StatutoryReturn {
  id: string;
  type: 'PAYE' | 'NSSF' | 'NHIF';
  period: string;
  due_date: string;
  total_amount: number;
  status: 'pending' | 'submitted' | 'paid' | 'overdue';
  submission_reference?: string;
  file_url?: string;
  submitted_at?: string;
  paid_at?: string;
}

interface ComplianceAlert {
  id: string;
  type: 'due_soon' | 'overdue' | 'rule_change';
  message: string;
  due_date?: string;
  priority: 'low' | 'medium' | 'high';
  acknowledged: boolean;
}

function StatutoryRemittance() {
  const [returns, setReturns] = useState<StatutoryReturn[]>([]);
  const [alerts, setAlerts] = useState<ComplianceAlert[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('2024-12');
  const [isLoading, setIsLoading] = useState(false);

  // Mock data for demonstration
  const mockReturns: StatutoryReturn[] = [
    {
      id: '1',
      type: 'PAYE',
      period: '2024-12',
      due_date: '2025-01-09',
      total_amount: 450000,
      status: 'pending',
    },
    {
      id: '2',
      type: 'NSSF',
      period: '2024-12',
      due_date: '2025-01-15',
      total_amount: 180000,
      status: 'pending',
    },
    {
      id: '3',
      type: 'NHIF',
      period: '2024-12',
      due_date: '2025-01-15',
      total_amount: 67500,
      status: 'submitted',
      submission_reference: 'NHIF-2024-12-001',
      submitted_at: '2024-12-28',
    },
    {
      id: '4',
      type: 'PAYE',
      period: '2024-11',
      due_date: '2024-12-09',
      total_amount: 435000,
      status: 'paid',
      submission_reference: 'KRA-2024-11-001',
      submitted_at: '2024-11-30',
      paid_at: '2024-12-05',
    },
  ];

  const mockAlerts: ComplianceAlert[] = [
    {
      id: '1',
      type: 'due_soon',
      message: 'PAYE return for December 2024 is due on January 9, 2025',
      due_date: '2025-01-09',
      priority: 'high',
      acknowledged: false,
    },
    {
      id: '2',
      type: 'due_soon',
      message:
        'NSSF and NHIF contributions for December 2024 are due on January 15, 2025',
      due_date: '2025-01-15',
      priority: 'medium',
      acknowledged: false,
    },
    {
      id: '3',
      type: 'rule_change',
      message:
        'New tax brackets effective from January 2025 - Update your payroll calculations',
      priority: 'medium',
      acknowledged: false,
    },
  ];

  useEffect(() => {
    setReturns(mockReturns);
    setAlerts(mockAlerts);
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Paid
          </Badge>
        );
      case 'submitted':
        return (
          <Badge className="bg-blue-100 text-blue-800">
            <Send className="w-3 h-3 mr-1" />
            Submitted
          </Badge>
        );
      case 'overdue':
        return (
          <Badge className="bg-red-100 text-red-800">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Overdue
          </Badge>
        );
      default:
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-l-red-500';
      case 'medium':
        return 'border-l-yellow-500';
      default:
        return 'border-l-blue-500';
    }
  };

  const handleGenerateFile = async (returnId: string, type: string) => {
    setIsLoading(true);
    try {
      // Mock file generation
      await new Promise((resolve) => setTimeout(resolve, 2000));

      toast({
        title: 'File Generated',
        description: `${type} remittance file has been generated successfully.`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate remittance file',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitReturn = async (returnId: string, type: string) => {
    setIsLoading(true);
    try {
      // Mock submission
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Update return status
      setReturns((prev) =>
        prev.map((ret) =>
          ret.id === returnId
            ? {
                ...ret,
                status: 'submitted',
                submission_reference: `${type}-${Date.now()}`,
                submitted_at: new Date().toISOString(),
              }
            : ret,
        ),
      );

      toast({
        title: 'Return Submitted',
        description: `${type} return has been submitted successfully.`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to submit return',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const acknowledgeAlert = (alertId: string) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === alertId ? { ...alert, acknowledged: true } : alert,
      ),
    );
  };

  const pendingReturns = returns.filter(
    (r) => r.status === 'pending' || r.status === 'overdue',
  );
  const upcomingDue = returns.filter((r) => {
    const dueDate = new Date(r.due_date);
    const today = new Date();
    const daysDiff = Math.ceil(
      (dueDate.getTime() - today.getTime()) / (1000 * 3600 * 24),
    );
    return (
      daysDiff <= 7 &&
      daysDiff > 0 &&
      (r.status === 'pending' || r.status === 'overdue')
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">
            Statutory Remittance & Compliance
          </h1>
          <p className="text-muted-foreground">
            Manage KRA, NSSF, and NHIF submissions
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Import Data
          </Button>
          <Button>
            <FileText className="mr-2 h-4 w-4" />
            Generate All Files
          </Button>
        </div>
      </div>

      {/* Alert Banner */}
      {alerts.filter((a) => !a.acknowledged).length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-yellow-600" />
              <CardTitle className="text-yellow-800">
                Compliance Alerts
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts
              .filter((a) => !a.acknowledged)
              .slice(0, 3)
              .map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-center justify-between p-3 border-l-4 bg-white rounded ${getPriorityColor(alert.priority)}`}
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm">{alert.message}</span>
                    {alert.due_date && (
                      <Badge variant="outline" className="text-xs">
                        Due: {new Date(alert.due_date).toLocaleDateString()}
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => acknowledgeAlert(alert.id)}
                  >
                    Acknowledge
                  </Button>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Returns
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingReturns.length}</div>
            <p className="text-xs text-muted-foreground">Require submission</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Due This Week</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingDue.length}</div>
            <p className="text-xs text-muted-foreground">Upcoming deadlines</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Amount Due
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                pendingReturns.reduce((sum, ret) => sum + ret.total_amount, 0),
              )}
            </div>
            <p className="text-xs text-muted-foreground">Pending payments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Compliance Score
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">95%</div>
            <p className="text-xs text-muted-foreground">On-time submissions</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="returns" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="returns">Statutory Returns</TabsTrigger>
          <TabsTrigger value="paye">KRA iTax PAYE</TabsTrigger>
          <TabsTrigger value="contributions">NSSF & NHIF</TabsTrigger>
          <TabsTrigger value="schedule">Payment Schedule</TabsTrigger>
        </TabsList>

        <TabsContent value="returns" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>All Statutory Returns</CardTitle>
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
                  {returns.map((returnItem) => (
                    <TableRow key={returnItem.id}>
                      <TableCell className="font-medium">
                        {returnItem.type}
                      </TableCell>
                      <TableCell>{returnItem.period}</TableCell>
                      <TableCell>
                        {formatCurrency(returnItem.total_amount)}
                      </TableCell>
                      <TableCell>
                        {new Date(returnItem.due_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{getStatusBadge(returnItem.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {returnItem.submission_reference || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleGenerateFile(returnItem.id, returnItem.type)
                            }
                            disabled={isLoading}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          {returnItem.status === 'pending' && (
                            <Button
                              size="sm"
                              onClick={() =>
                                handleSubmitReturn(
                                  returnItem.id,
                                  returnItem.type,
                                )
                              }
                              disabled={isLoading}
                            >
                              Submit
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
        </TabsContent>

        <TabsContent value="paye" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>KRA iTax PAYE Returns</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tax Period</Label>
                  <Select
                    value={selectedPeriod}
                    onValueChange={setSelectedPeriod}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2024-12">December 2024</SelectItem>
                      <SelectItem value="2024-11">November 2024</SelectItem>
                      <SelectItem value="2024-10">October 2024</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>KRA PIN</Label>
                  <Input placeholder="Enter KRA PIN" />
                </div>
              </div>

              <div className="p-4 border rounded-lg bg-muted/50">
                <h4 className="font-medium mb-2">
                  PAYE Summary for {selectedPeriod}
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>Total Employees: 45</div>
                  <div>Total PAYE: {formatCurrency(450000)}</div>
                  <div>Due Date: 9th January 2025</div>
                  <div>Status: Pending Submission</div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => handleGenerateFile('paye', 'PAYE')}
                  disabled={isLoading}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Generate P9A Form
                </Button>
                <Button variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Download Excel Template
                </Button>
                <Button variant="outline">
                  <Send className="mr-2 h-4 w-4" />
                  Submit to iTax
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contributions" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>NSSF Contributions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">December 2024</span>
                    <Badge variant="outline">Tier I & II</Badge>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Employee Contributions:</span>
                      <span>{formatCurrency(90000)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Employer Contributions:</span>
                      <span>{formatCurrency(90000)}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Total:</span>
                      <span>{formatCurrency(180000)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm">
                    <FileText className="mr-2 h-4 w-4" />
                    Generate File
                  </Button>
                  <Button size="sm" variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>NHIF Contributions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">December 2024</span>
                    <Badge className="bg-blue-100 text-blue-800">
                      Submitted
                    </Badge>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Total Deductions:</span>
                      <span>{formatCurrency(67500)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Reference:</span>
                      <span>NHIF-2024-12-001</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Submitted:</span>
                      <span>28 Dec 2024</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">
                    <FileText className="mr-2 h-4 w-4" />
                    View Receipt
                  </Button>
                  <Button size="sm" variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment Schedule & Deadlines</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg border-yellow-200 bg-yellow-50">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4 text-yellow-600" />
                      <span className="font-medium">PAYE Returns</span>
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">
                      Due: 9th of following month
                    </div>
                    <div className="text-sm">
                      Next: <span className="font-medium">Jan 9, 2025</span>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg border-blue-200 bg-blue-50">
                    <div className="flex items-center gap-2 mb-2">
                      <Building className="h-4 w-4 text-blue-600" />
                      <span className="font-medium">NSSF & NHIF</span>
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">
                      Due: 15th of following month
                    </div>
                    <div className="text-sm">
                      Next: <span className="font-medium">Jan 15, 2025</span>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg border-green-200 bg-green-50">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="font-medium">Compliance Rate</span>
                    </div>
                    <div className="text-2xl font-bold text-green-600">95%</div>
                    <div className="text-sm text-muted-foreground">
                      On-time submissions
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <h4 className="font-medium mb-3">Upcoming Deadlines</h4>
                  <div className="space-y-2">
                    {[
                      {
                        type: 'PAYE',
                        period: 'Dec 2024',
                        due: '2025-01-09',
                        amount: 450000,
                      },
                      {
                        type: 'NSSF',
                        period: 'Dec 2024',
                        due: '2025-01-15',
                        amount: 180000,
                      },
                      {
                        type: 'NHIF',
                        period: 'Dec 2024',
                        due: '2025-01-15',
                        amount: 67500,
                      },
                      {
                        type: 'PAYE',
                        period: 'Jan 2025',
                        due: '2025-02-09',
                        amount: 465000,
                      },
                    ].map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{item.type}</Badge>
                          <span className="text-sm">{item.period}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-medium">
                            {formatCurrency(item.amount)}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            Due: {new Date(item.due).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default StatutoryRemittance;
