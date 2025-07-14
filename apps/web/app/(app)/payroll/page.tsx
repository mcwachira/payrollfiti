'use client';
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calculator,
  FileText,
  Users,
  Download,
  Send,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
} from 'lucide-react';
import { formatCurrency } from '@/utils/payrollCalculations';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  employee_number: string;
  basic_salary: number;
  department: string;
  job_title: string;
}

interface PayrollPeriod {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  pay_date: string;
  status: 'draft' | 'processed' | 'approved' | 'paid';
  total_gross: number;
  total_deductions: number;
  total_net: number;
}

function PayrollManagementPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrollPeriods, setPayrollPeriods] = useState<PayrollPeriod[]>([
    {
      id: '7a01e4d2-b3a3-46ff-b79b-f84d8c491001',

      name: 'July 2024 - First Half',
      start_date: '2024-07-01',
      end_date: '2024-07-15',
      pay_date: '2024-07-20',
      status: 'draft',
      total_gross: 50000.0,
      total_deductions: 5000.0,
      total_net: 45000.0,
    },
    {
      id: '8b3c9b32-d2f4-4421-a7fd-91cf201a2002',

      name: 'June 2024 - Full Month',
      start_date: '2024-06-01',
      end_date: '2024-06-30',
      pay_date: '2024-07-05',
      status: 'processed',
      total_gross: 120000.0,
      total_deductions: 15000.0,
      total_net: 105000.0,
    },
    {
      id: '9e8c3a21-0123-46fc-baa9-29e4b4043003',

      name: 'Q2 2024 Summary',
      start_date: '2024-04-01',
      end_date: '2024-06-30',
      pay_date: '2024-07-10',
      status: 'approved',
      total_gross: 300000.0,
      total_deductions: 40000.0,
      total_net: 260000.0,
    },
    {
      id: '44ee6a19-f1b9-4412-91cf-ff6a6d1a4004',
      name: 'July 2024 - Second Half',
      start_date: '2024-07-16',
      end_date: '2024-07-31',
      pay_date: '2024-08-05',
      status: 'draft',
      total_gross: 75000.0,
      total_deductions: 10000.0,
      total_net: 65000.0,
    },
    {
      id: '1d3e9c91-0ecf-457d-9dc5-29cb18a45005',

      name: 'Mid-Year Bonus 2024',
      start_date: '2024-07-01',
      end_date: '2024-07-01',
      pay_date: '2024-07-15',
      status: 'approved',
      total_gross: 200000.0,
      total_deductions: 0.0,
      total_net: 200000.0,
    },
  ]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null,
  );
  const [selectedPeriod, setSelectedPeriod] = useState<PayrollPeriod | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const periodsdata = [
    {
      id: '7a01e4d2-b3a3-46ff-b79b-f84d8c491001',

      name: 'July 2024 - First Half',
      start_date: '2024-07-01',
      end_date: '2024-07-15',
      pay_date: '2024-07-20',
      status: 'draft',
      total_gross: 50000.0,
      total_deductions: 5000.0,
      total_net: 45000.0,
    },
    {
      id: '8b3c9b32-d2f4-4421-a7fd-91cf201a2002',

      name: 'June 2024 - Full Month',
      start_date: '2024-06-01',
      end_date: '2024-06-30',
      pay_date: '2024-07-05',
      status: 'processed',
      total_gross: 120000.0,
      total_deductions: 15000.0,
      total_net: 105000.0,
    },
    {
      id: '9e8c3a21-0123-46fc-baa9-29e4b4043003',

      name: 'Q2 2024 Summary',
      start_date: '2024-04-01',
      end_date: '2024-06-30',
      pay_date: '2024-07-10',
      status: 'approved',
      total_gross: 300000.0,
      total_deductions: 40000.0,
      total_net: 260000.0,
    },
    {
      id: '44ee6a19-f1b9-4412-91cf-ff6a6d1a4004',
      name: 'July 2024 - Second Half',
      start_date: '2024-07-16',
      end_date: '2024-07-31',
      pay_date: '2024-08-05',
      status: 'draft',
      total_gross: 75000.0,
      total_deductions: 10000.0,
      total_net: 65000.0,
    },
    {
      id: '1d3e9c91-0ecf-457d-9dc5-29cb18a45005',

      name: 'Mid-Year Bonus 2024',
      start_date: '2024-07-01',
      end_date: '2024-07-01',
      pay_date: '2024-07-15',
      status: 'approved',
      total_gross: 200000.0,
      total_deductions: 0.0,
      total_net: 200000.0,
    },
  ];

  useEffect(() => {
    fetchData();
    setPayrollPeriods(periodsdata || []);
  }, []);

  const fetchData = async () => {
    // setIsLoading(true);
    // try {
    //   // Fetch employees
    //   const { data: employeesData, error: employeesError } = await supabase
    //     .from('employees')
    //     .select('*')
    //     .eq('employment_status', 'active')
    //     .order('first_name');
    //   if (employeesError) throw employeesError;
    //   // Fetch payroll periods
    //   const { data: periodsData, error: periodsError } = await supabase
    //     .from('payroll_periods')
    //     .select('*')
    //     .order('start_date', { ascending: false })
    //     .limit(10);
    //   if (periodsError) throw periodsError;
    //   setEmployees(employeesData || []);
    //   setPayrollPeriods(periodsData || []);
    // } catch (error) {
    //   console.error('Error fetching data:', error);
    //   toast({
    //     title: "Error",
    //     description: "Failed to load payroll data",
    //     variant: "destructive"
    //   });
    // } finally {
    //   setIsLoading(false);
    // }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'processed':
        return 'bg-blue-100 text-blue-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'paid':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <Clock className="h-4 w-4" />;
      case 'processed':
        return <Calculator className="h-4 w-4" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4" />;
      case 'paid':
        return <DollarSign className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employee_number.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  //   if (isLoading) {
  //     return (
  //       <div className="flex items-center justify-center h-64">
  //         <div className="text-center">
  //           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
  //           <p className="text-muted-foreground">Loading payroll data...</p>
  //         </div>
  //       </div>
  //     );
  //   }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Payroll Management</h1>
          <p className="text-muted-foreground">
            Calculate and manage employee payroll
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            Bulk Upload
          </Button>
          <Button>
            <Calculator className="mr-2 h-4 w-4" />
            New Payroll Run
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="calculate">Calculate</TabsTrigger>
          <TabsTrigger value="periods">Periods</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Employees
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{employees.length}</div>
                <p className="text-xs text-muted-foreground">
                  Ready for payroll
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Current PeriodperiodsData
                </CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Jan 2025</div>
                <p className="text-xs text-muted-foreground">1-31 January</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Est. Gross Pay
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">KES 2.5M</div>
                <p className="text-xs text-muted-foreground">
                  +4.2% from last month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Pending Actions
                </CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">3</div>
                <p className="text-xs text-muted-foreground">
                  Requires attention
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Payroll Periods */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Payroll Periods</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {payrollPeriods.slice(0, 5).map((period) => (
                  <div
                    key={period.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(period.status)}
                      <div>
                        <h4 className="font-medium">{period.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {new Date(period.start_date).toLocaleDateString()} -{' '}
                          {new Date(period.end_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-medium">
                          {formatCurrency(period.total_net || 0)}
                        </p>
                        <p className="text-sm text-muted-foreground">Net Pay</p>
                      </div>
                      <Badge className={getStatusColor(period.status)}>
                        {period.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calculate" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Employee Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Select Employee</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredEmployees.map((employee) => (
                    <div
                      key={employee.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedEmployee?.id === employee.id
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedEmployee(employee)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">
                            {employee.first_name} {employee.last_name}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {employee.employee_number}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {employee.job_title} • {employee.department}
                          </p>
                        </div>
                        <p className="text-sm font-medium">
                          {formatCurrency(employee.basic_salary)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Payroll Calculator */}
            <div className="lg:col-span-2">
              {selectedEmployee ? (
                <PayrollCalculator
                  employeeId={selectedEmployee.id}
                  employeeName={`${selectedEmployee.first_name} ${selectedEmployee.last_name}`}
                  defaultSalary={selectedEmployee.basic_salary}
                  onSave={(calculation) => {
                    toast({
                      title: 'Calculation Saved',
                      description: `Payroll calculation for ${selectedEmployee.first_name} ${selectedEmployee.last_name} has been saved.`,
                    });
                  }}
                />
              ) : (
                <Card>
                  <CardContent className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <Calculator className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="font-medium mb-2">Select an Employee</h3>
                      <p className="text-muted-foreground">
                        Choose an employee from the list to start calculating
                        their payroll
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="periods" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payroll Periods</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {payrollPeriods.map((period) => (
                  <div
                    key={period.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      {getStatusIcon(period.status)}
                      <div>
                        <h4 className="font-medium">{period.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {new Date(period.start_date).toLocaleDateString()} -{' '}
                          {new Date(period.end_date).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Pay Date:{' '}
                          {new Date(period.pay_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-medium">
                          {formatCurrency(period.total_gross || 0)}
                        </p>
                        <p className="text-sm text-muted-foreground">Gross</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          {formatCurrency(period.total_net || 0)}
                        </p>
                        <p className="text-sm text-muted-foreground">Net</p>
                      </div>
                      <Badge className={getStatusColor(period.status)}>
                        {period.status}
                      </Badge>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                        {period.status === 'draft' && (
                          <Button size="sm">Process</Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Payroll Reports</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="mr-2 h-4 w-4" />
                  Monthly Payroll Summary
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Download className="mr-2 h-4 w-4" />
                  Employee Payslips
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="mr-2 h-4 w-4" />
                  Year-to-Date Report
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Download className="mr-2 h-4 w-4" />
                  Export to Excel
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Statutory Reports</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" className="w-full justify-start">
                  <Send className="mr-2 h-4 w-4" />
                  PAYE Return (P9A)
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Send className="mr-2 h-4 w-4" />
                  NSSF Contributions
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Send className="mr-2 h-4 w-4" />
                  NHIF Remittance
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="mr-2 h-4 w-4" />
                  Bank Payment File
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Compliance Dashboard */}
          <Card>
            <CardHeader>
              <CardTitle>Compliance Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <h4 className="font-medium">PAYE Returns</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    December 2024 - Submitted
                  </p>
                  <p className="text-xs text-green-600">Due: 9th Jan 2025</p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    <h4 className="font-medium">NSSF</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    December 2024 - Pending
                  </p>
                  <p className="text-xs text-yellow-600">Due: 15th Jan 2025</p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    <h4 className="font-medium">NHIF</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    December 2024 - Pending
                  </p>
                  <p className="text-xs text-yellow-600">Due: 15th Jan 2025</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default PayrollManagementPage;
