import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  User,
  Building,
  CreditCard,
  Phone,
  MapPin,
  Calendar,
  FileText,
} from 'lucide-react';
import { Employee } from '@/types/types';

interface EmployeeDetailsProps {
  employee: Employee;
  onClose: () => void;
}

export const EmployeeDetails: React.FC<EmployeeDetailsProps> = ({
  employee,
  onClose,
}) => {
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {employee.first_name} {employee.middle_name} {employee.last_name}
          </h3>
          <p className="text-sm text-muted-foreground">
            Employee #{employee.employee_number}
          </p>
        </div>
        <Badge
          className={getStatusColor(employee.employment_status || 'active')}
        >
          {employee.employment_status || 'active'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Date of Birth
                </p>
                <p>{formatDate(employee.date_of_birth)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Gender
                </p>
                <p>{employee.gender || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  National ID
                </p>
                <p>{employee.national_id || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  KRA PIN
                </p>
                <p>{employee.kra_pin || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Employment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Job Title
                </p>
                <p>{employee.job_title || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Department
                </p>
                <p>{employee.department || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Hire Date
                </p>
                <p>{formatDate(employee.hire_date)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Contract Type
                </p>
                <p>{employee.contract_type || 'N/A'}</p>
              </div>
            </div>
            {employee.probation_end_date && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Probation End Date
                </p>
                <p>{formatDate(employee.probation_end_date)}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Financial Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Basic Salary
              </p>
              <p className="text-lg font-semibold">
                KES {employee.basic_salary?.toLocaleString()}
              </p>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  NSSF Number
                </p>
                <p>{employee.nssf_number || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  NHIF Number
                </p>
                <p>{employee.nhif_number || 'N/A'}</p>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Banking Details
              </p>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <p>
                  <span className="font-medium">Bank:</span>{' '}
                  {employee.bank_name || 'N/A'}
                </p>
                <p>
                  <span className="font-medium">Account:</span>{' '}
                  {employee.bank_account || 'N/A'}
                </p>
                <p>
                  <span className="font-medium">Branch:</span>{' '}
                  {employee.bank_branch || 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p>{employee.email || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Phone</p>
              <p>{employee.phone || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Address
              </p>
              <p>{employee.address || 'N/A'}</p>
            </div>
            <Separator />
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Emergency Contact
              </p>
              <div className="text-sm space-y-1">
                <p>
                  <span className="font-medium">Name:</span>{' '}
                  {employee.emergency_contact_name || 'N/A'}
                </p>
                <p>
                  <span className="font-medium">Phone:</span>{' '}
                  {employee.emergency_contact_phone || 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={onClose}>Close</Button>
      </div>
    </div>
  );
};
