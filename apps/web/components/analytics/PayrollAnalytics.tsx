'use client';

import React, { useEffect, useState } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import {
  DollarSign,
  Users,
  TrendingUp,
  Calendar,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import payrollData from '@/data/payroll.json';
import {
  CurrentSummary,
  DepartmentData,
  LeaveImpact,
  PayrollAnalytic,
} from '@/types/payroll-data';
import { formatCurrency } from '@/utils/payrollCalculations';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const PayrollAnalytics = () => {
  const [analytics, setAnalytics] = useState<PayrollAnalytic[]>([]);
  const [currentSummary, setCurrentSummary] = useState<CurrentSummary[]>();
  const [departmentData, setDepartmentData] = useState<DepartmentData[]>([]);
  const [leaveImpact, setLeaveImpact] = useState<LeaveImpact[]>([]);

  useEffect(() => {
    setAnalytics(payrollData.payroll_analytics);
    setCurrentSummary(payrollData.current_summary);
    setDepartmentData(payrollData.department_breakdown);
    setLeaveImpact(payrollData.leave_impact);
  });
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Employees
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentSummary?.employeeCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Total active workforce
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
              {formatCurrency(currentSummary?.totalGross || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Current month total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Deductions
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(currentSummary?.totalDeductions || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Statutory + Voluntary
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Payroll</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(currentSummary?.totalNet || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              After all deductions
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="leave-impact">Leave Impact</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Payroll Trend Chart */}
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>Payroll Trends</CardTitle>
                <CardDescription>
                  Monthly payroll costs over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="period_start"
                      tickFormatter={(value) =>
                        new Date(value).toLocaleDateString('default', {
                          month: 'short',
                        })
                      }
                    />
                    <YAxis
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                    />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), '']}
                      labelFormatter={(value) =>
                        new Date(value).toLocaleDateString()
                      }
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="total_gross_pay"
                      stroke="#8884d8"
                      name="Gross Pay"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="total_net_pay"
                      stroke="#82ca9d"
                      name="Net Pay"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="total_deductions"
                      stroke="#ffc658"
                      name="Deductions"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="departments" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Department Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Employee Distribution by Department</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={departmentData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {departmentData?.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Department Salary Costs */}
            <Card>
              <CardHeader>
                <CardTitle>Salary Costs by Department</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={departmentData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                    />
                    <Tooltip
                      formatter={(value: number) => [
                        formatCurrency(value),
                        'Total Salary',
                      ]}
                    />
                    <Bar dataKey="totalSalary" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Employee Count Trends</CardTitle>
              <CardDescription>
                Track workforce changes over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="period_start"
                    tickFormatter={(value) =>
                      new Date(value).toLocaleDateString('default', {
                        month: 'short',
                      })
                    }
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(value) =>
                      new Date(value).toLocaleDateString()
                    }
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="total_employees"
                    stroke="#8884d8"
                    name="Total Employees"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="active_employees"
                    stroke="#82ca9d"
                    name="Active Employees"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="new_hires"
                    stroke="#ffc658"
                    name="New Hires"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="terminations"
                    stroke="#ff7c7c"
                    name="Terminations"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leave-impact" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Leave Impact on Payroll
              </CardTitle>
              <CardDescription>
                Track how leave affects payroll costs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={leaveImpact}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis
                    yAxisId="left"
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                  />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      name === 'totalDeduction'
                        ? formatCurrency(value)
                        : `${value} days`,
                      name === 'totalDeduction'
                        ? 'Amount Deducted'
                        : 'Leave Days',
                    ]}
                  />
                  <Legend />
                  <Bar
                    yAxisId="left"
                    dataKey="totalDeduction"
                    fill="#8884d8"
                    name="Amount Deducted"
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="totalDays"
                    fill="#82ca9d"
                    name="Leave Days"
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PayrollAnalytics;
