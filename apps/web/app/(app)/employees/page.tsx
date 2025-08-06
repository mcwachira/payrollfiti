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
} from 'lucide-react';
import { toast } from 'sonner';
import { EmployeeForm } from '@/components/employees/EmployeeForm';
import { EmployeeDetails } from '@/components/employees/EmployeeDetails';
import EmployeeDocuments from '@/components/employees/EmployeeDocuments';
import { EmployeeList } from '@/components/employees/EmployeeList';

const EmployeesPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState();
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);

  const employees = [
    {
      id: '550e8400-e29b-41d4-a716-446655440000',
      first_name: 'Kevin',
      last_name: 'Smith',
      gender: 'Male',
      date_of_birth: '1990-01-01',
      email: 'kevin.smith@example.com',
      phone: '254712345678',
      company_id: '021e7f48-52dc-49c9-9358-8cce9cdc6842',
      employee_number: 'EMP001',
      hire_date: '2020-01-15',
      termination_date: '',
      created_at: '2023-06-01 09:00:00',
      updated_at: '2023-06-01 09:00:00',
      basic_salary: '55000.00',
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      first_name: 'Susan',
      last_name: 'Johnson',
      gender: 'Female',
      date_of_birth: '1985-05-20',
      email: 'susan.johnson@example.com',
      phone: '254722334455',
      company_id: '0f1fd188-f30d-4ca5-b24c-ba0597c7cf6c',
      employee_number: 'EMP002',
      hire_date: '2018-03-12',
      termination_date: '',
      created_at: '2023-05-01 10:00:00',
      updated_at: '2023-05-01 10:00:00',
      basic_salary: '62000.00',
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440002',
      first_name: 'Michael',
      last_name: 'Brown',
      gender: 'Male',
      date_of_birth: '1988-08-14',
      email: 'michael.brown@example.com',
      phone: '254732112233',
      company_id: '10574faf-3c35-4007-ad6c-f699ac829087',
      employee_number: 'EMP003',
      hire_date: '2019-07-10',
      termination_date: '',
      created_at: '2023-07-01 11:00:00',
      updated_at: '2023-07-01 11:00:00',
      basic_salary: '58000.00',
    },
  ];

  const handleDelete = async (employeeId: string) => {
    if (!confirm('Are you sure you want to delete this employee?')) return;
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    // setSelectedEmployee();
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'terminated':
        return 'bg-red-100 text-red-800';
      case 'suspended':
        return 'bg-yellow-100 text-yellow-800';
      case 'on_leave':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  // if (isLoading) {
  //   return (
  //     <div className="flex items-center justify-center h-64">
  //       <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  //     </div>
  //   );
  // }

  // if (error) {
  //   return (
  //     <Card>
  //       <CardContent className="p-6">
  //         <p className="text-red-600">
  //           Error loading employees: {error.message}
  //         </p>
  //       </CardContent>
  //     </Card>
  //   );
  // }
  return (
    // <div className="space-y-6">
    //   <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
    //     <div>
    //       <h2 className="text-2xl font-bold">Employee Management</h2>
    //       <p className="text-muted-foreground">
    //         Manage your organization's employees
    //       </p>
    //     </div>
    //     <Dialog open={showForm} onOpenChange={setShowForm}>
    //       <DialogTrigger asChild>
    //         <Button onClick={() => setSelectedEmployee('')}>
    //           <Plus className="h-4 w-4 mr-2" />
    //           Add Employee
    //         </Button>
    //       </DialogTrigger>
    //       <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
    //         <DialogHeader>
    //           <DialogTitle>
    //             {selectedEmployee ? 'Edit Employee' : 'Add New Employee'}
    //           </DialogTitle>
    //         </DialogHeader>
    //         <EmployeeForm
    //           employee={selectedEmployee}
    //           onSuccess={handleFormSuccess}
    //           onCancel={() => setShowForm(false)}
    //         />
    //       </DialogContent>
    //     </Dialog>
    //   </div>

    //   <Card>
    //     <CardHeader>
    //       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
    //         <div>
    //           <CardTitle>Employees ({filteredEmployees.length})</CardTitle>
    //           <CardDescription>
    //             Manage employee records and information
    //           </CardDescription>
    //         </div>

    //         <div className="flex gap-2">
    //           <div className="relative">
    //             <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
    //             <Input
    //               placeholder="Search employees..."
    //               value={searchTerm}
    //               onChange={(e) => setSearchTerm(e.target.value)}
    //               className="pl-10 w-64"
    //             />
    //           </div>
    //           <Button variant="outline" size="icon">
    //             <Filter className="h-4 w-4" />
    //           </Button>
    //         </div>
    //       </div>
    //     </CardHeader>
    //     <CardContent>
    //       <div className="overflow-x-auto">
    //         <Table>
    //           <TableHeader>
    //             <TableRow>
    //               <TableHead>Employee #</TableHead>
    //               <TableHead>Name</TableHead>
    //               <TableHead>Job Title</TableHead>
    //               <TableHead>Department</TableHead>
    //               <TableHead>Status</TableHead>
    //               <TableHead>Salary</TableHead>
    //               <TableHead>Actions</TableHead>
    //             </TableRow>
    //           </TableHeader>
    //           <TableBody>
    //             {filteredEmployees.map((employee) => (
    //               <TableRow key={employee.id}>
    //                 <TableCell className="font-medium">
    //                   {employee.employee_number}
    //                 </TableCell>
    //                 <TableCell>
    //                   <div>
    //                     <div className="font-medium">
    //                       {employee.first_name} {employee.last_name}
    //                     </div>
    //                     <div className="text-sm text-muted-foreground">
    //                       {employee.email}
    //                     </div>
    //                   </div>
    //                 </TableCell>
    //                 <TableCell>{employee.job_title || 'N/A'}</TableCell>
    //                 <TableCell>{employee.department || 'N/A'}</TableCell>
    //                 <TableCell>
    //                   <Badge
    //                     className={getStatusColor(
    //                       employee.employment_status || 'active',
    //                     )}
    //                   >
    //                     {employee.employment_status || 'active'}
    //                   </Badge>
    //                 </TableCell>
    //                 <TableCell>
    //                   KES {employee.basic_salary?.toLocaleString() || 0}
    //                 </TableCell>
    //                 <TableCell>
    //                   <DropdownMenu>
    //                     <DropdownMenuTrigger asChild>
    //                       <Button variant="ghost" size="sm">
    //                         <MoreHorizontal className="h-4 w-4" />
    //                       </Button>
    //                     </DropdownMenuTrigger>
    //                     <DropdownMenuContent align="end">
    //                       <DropdownMenuItem
    //                         onClick={() => {
    //                           setSelectedEmployee(employee);
    //                           setShowDetails(true);
    //                         }}
    //                       >
    //                         <Eye className="h-4 w-4 mr-2" />
    //                         View Details
    //                       </DropdownMenuItem>
    //                       <DropdownMenuItem
    //                         onClick={() => {
    //                           setSelectedEmployee(employee);
    //                           setShowForm(true);
    //                         }}
    //                       >
    //                         <Edit className="h-4 w-4 mr-2" />
    //                         Edit
    //                       </DropdownMenuItem>
    //                       <DropdownMenuItem
    //                         onClick={() => {
    //                           setSelectedEmployee(employee);
    //                           setShowDocuments(true);
    //                         }}
    //                       >
    //                         <FileText className="h-4 w-4 mr-2" />
    //                         Documents
    //                       </DropdownMenuItem>
    //                       <DropdownMenuItem
    //                         onClick={() => handleDelete(employee.id)}
    //                         className="text-red-600"
    //                       >
    //                         <Trash2 className="h-4 w-4 mr-2" />
    //                         Delete
    //                       </DropdownMenuItem>
    //                     </DropdownMenuContent>
    //                   </DropdownMenu>
    //                 </TableCell>
    //               </TableRow>
    //             ))}
    //           </TableBody>
    //         </Table>
    //       </div>
    //     </CardContent>
    //   </Card>

    //   {/* Employee Form Dialog */}
    //   <Dialog open={showForm} onOpenChange={setShowForm}>
    //     <DialogTrigger asChild>
    //       <Button onClick={() => setSelectedEmployee(null)} className="hidden">
    //         <Plus className="h-4 w-4 mr-2" />
    //         Add Employee
    //       </Button>
    //     </DialogTrigger>
    //     <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
    //       <DialogHeader>
    //         <DialogTitle>
    //           {selectedEmployee ? 'Edit Employee' : 'Add New Employee'}
    //         </DialogTitle>
    //       </DialogHeader>
    //       <EmployeeForm
    //         employee={selectedEmployee}
    //         onSuccess={handleFormSuccess}
    //         onCancel={() => setShowForm(false)}
    //       />
    //     </DialogContent>
    //   </Dialog>

    //   {/* Employee Details Dialog */}
    //   <Dialog open={showDetails} onOpenChange={setShowDetails}>
    //     <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
    //       <DialogHeader>
    //         <DialogTitle>Employee Details</DialogTitle>
    //       </DialogHeader>
    //       {selectedEmployee && (
    //         <EmployeeDetails
    //           employee={selectedEmployee}
    //           onClose={() => setShowDetails(false)}
    //         />
    //       )}
    //     </DialogContent>
    //   </Dialog>

    //   {/* Employee Documents Dialog */}
    //   <Dialog open={showDocuments} onOpenChange={setShowDocuments}>
    //     <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
    //       <DialogHeader>
    //         <DialogTitle>
    //           Employee Documents - {selectedEmployee?.first_name}{' '}
    //           {selectedEmployee?.last_name}
    //         </DialogTitle>
    //       </DialogHeader>
    //       {selectedEmployee && (
    //         <EmployeeDocuments employeeId={selectedEmployee.id} />
    //       )}
    //     </DialogContent>
    //   </Dialog>
    // </div>
    //
    <div className="container mx-auto p-6">
      <EmployeeList employees={employees} />
    </div>
  );
};

export default EmployeesPage;
