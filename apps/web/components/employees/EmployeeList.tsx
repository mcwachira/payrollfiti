'use client';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  FileText,
  Users,
  UserPlus,
  Calendar,
  Building,
} from 'lucide-react';

import { toast } from 'sonner';
import { EmployeeForm } from './EmployeeForm';
import { EmployeeDetails } from './EmployeeDetails';
import EmployeeDocuments from './EmployeeDocuments';
import { removeEmployee } from '@/lib/employees-api';
import { ApiError } from '@/lib/api-client';
import { getEmployeeStatusColor } from '@/lib/status-styles';
import type { Employee } from '@/types/types';

interface EmployeeListProps {
  employees: Employee[];
  companyId: string;
  onEmployeeSaved: () => void;
}

export const EmployeeList = ({
  employees,
  companyId,
  onEmployeeSaved,
}: EmployeeListProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null,
  );
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);

  const handleDelete = async (employeeId: string) => {
    if (!confirm('Are you sure you want to delete this employee?')) return;
    try {
      await removeEmployee(employeeId);
      toast.success('Employee removed');
      onEmployeeSaved();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : 'Failed to remove employee',
      );
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setSelectedEmployee(null);
    onEmployeeSaved();
  };

  const filteredEmployees =
    employees?.filter(
      (employee) =>
        employee.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.employee_number
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        employee.email?.toLowerCase().includes(searchTerm.toLowerCase()),
    ) || [];

  const now = new Date();
  const newHiresThisMonth = employees.filter((employee) => {
    if (!employee.hire_date) return false;
    const hireDate = new Date(employee.hire_date);
    return (
      hireDate.getFullYear() === now.getFullYear() &&
      hireDate.getMonth() === now.getMonth()
    );
  }).length;

  const tenuredEmployees = employees.filter((employee) => employee.hire_date);
  const averageTenureYears =
    tenuredEmployees.length > 0
      ? tenuredEmployees.reduce((sum, employee) => {
          const years =
            (now.getTime() - new Date(employee.hire_date!).getTime()) /
            (1000 * 60 * 60 * 24 * 365.25);
          return sum + years;
        }, 0) / tenuredEmployees.length
      : 0;

  const activeDepartments = new Set(
    employees.map((employee) => employee.department).filter(Boolean),
  ).size;

  const employeeStats = [
    { name: 'Total Employees', value: String(employees.length), icon: Users },
    {
      name: 'New Hires This Month',
      value: String(newHiresThisMonth),
      icon: UserPlus,
    },
    {
      name: 'Average Tenure (Years)',
      value: averageTenureYears.toFixed(1),
      icon: Calendar,
    },
    {
      name: 'Active Departments',
      value: String(activeDepartments),
      icon: Building,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold">Employee List</h2>
        </div>
        <div className="flex gap-2">
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogTrigger asChild>
              <Button onClick={() => setSelectedEmployee(null)}>
                <Plus className="h-4 w-4 mr-2" />
                Add a New Employee
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {selectedEmployee ? 'Edit Employee' : 'Add New Employee'}
                </DialogTitle>
              </DialogHeader>
              <EmployeeForm
                employee={selectedEmployee}
                companyId={companyId}
                onSuccess={handleFormSuccess}
                onCancel={() => setShowForm(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {employeeStats.map((stat) => (
          <Card key={stat.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.name}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Employee Summary */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="h-4 w-4" />
        <span>Total Employees: {filteredEmployees.length} employees</span>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Employee Directory</CardTitle>
              <CardDescription>
                Manage employee records and information
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search employee"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                aria-label="Filter employees"
              >
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      className="rounded"
                      aria-label="Select all employees"
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Join Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        className="rounded"
                        aria-label={`Select ${employee.first_name} ${employee.last_name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">
                            {employee.first_name.charAt(0)}
                            {employee.last_name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium">
                            {employee.first_name} {employee.last_name}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{employee.department || 'N/A'}</TableCell>
                    <TableCell>{employee.job_title || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge
                        className={getEmployeeStatusColor(
                          employee.employment_status || 'active',
                        )}
                      >
                        {employee.employment_status === 'active'
                          ? 'Active'
                          : employee.employment_status === 'on_leave'
                            ? 'On Leave'
                            : employee.employment_status === 'terminated'
                              ? 'Inactive'
                              : 'Active'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {employee.hire_date
                        ? new Date(employee.hire_date).toLocaleDateString()
                        : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Actions for ${employee.first_name} ${employee.last_name}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedEmployee(employee);
                              setShowDetails(true);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedEmployee(employee);
                              setShowForm(true);
                            }}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedEmployee(employee);
                              setShowDocuments(true);
                            }}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            View Documents
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(employee.id)}
                            className="text-red-600 dark:text-red-400"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Employee
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Employee Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Employee Details</DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <EmployeeDetails
              employee={selectedEmployee}
              onClose={() => setShowDetails(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Employee Documents Dialog */}
      <Dialog open={showDocuments} onOpenChange={setShowDocuments}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Employee Documents - {selectedEmployee?.first_name}{' '}
              {selectedEmployee?.last_name}
            </DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <EmployeeDocuments employeeId={selectedEmployee.id} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
