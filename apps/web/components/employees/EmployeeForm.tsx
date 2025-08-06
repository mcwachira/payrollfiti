'use client';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CalendarDays,
  User,
  Building,
  CreditCard,
  Phone,
  MapPin,
} from 'lucide-react';
import { Employee } from '@/types/types';

interface EmployeeFormProps {
  employee?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export const EmployeeForm: React.FC<EmployeeFormProps> = ({
  employee,
  onSuccess,
  onCancel,
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    employee_number: employee?.employee_number || '',
    first_name: employee?.first_name || '',
    middle_name: employee?.middle_name || '',
    last_name: employee?.last_name || '',
    email: employee?.email || '',
    phone: employee?.phone || '',
    date_of_birth: employee?.date_of_birth || '',
    gender: employee?.gender || '',
    national_id: employee?.national_id || '',
    kra_pin: employee?.kra_pin || '',
    nssf_number: employee?.nssf_number || '',
    nhif_number: employee?.nhif_number || '',
    bank_name: employee?.bank_name || '',
    bank_account: employee?.bank_account || '',
    bank_branch: employee?.bank_branch || '',
    job_title: employee?.job_title || '',
    department: employee?.department || '',
    hire_date: employee?.hire_date || '',
    employment_status: employee?.employment_status || 'active',
    basic_salary: employee?.basic_salary || '',
    contract_type: employee?.contract_type || '',
    probation_end_date: employee?.probation_end_date || '',
    address: employee?.address || '',
    emergency_contact_name: employee?.emergency_contact_name || '',
    emergency_contact_phone: employee?.emergency_contact_phone || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // try {
    //   const employeeData: TablesInsert<'employees'> = {
    //     ...formData,
    //     basic_salary: parseFloat(formData.basic_salary) || 0,
    //     company_id: 'temp-company-id', // This will be replaced with actual company ID from user context
    //   };

    //   if (employee?.id) {
    //     const { error } = await supabase
    //       .from('employees')
    //       .update(employeeData)
    //       .eq('id', employee.id);

    //     if (error) throw error;
    //     toast({ title: 'Employee updated successfully' });
    //   } else {
    //     const { error } = await supabase
    //       .from('employees')
    //       .insert([employeeData]);

    //     if (error) throw error;
    //     toast({ title: 'Employee created successfully' });
    //   }

    //   onSuccess();
    // } catch (error: any) {
    //   toast({
    //     title: 'Error',
    //     description: error.message,
    //     variant: 'destructive',
    //   });
    // } finally {
    //   setLoading(false);
    // }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs defaultValue="personal" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="employee_number">Employee Number *</Label>
                <Input
                  id="employee_number"
                  value={formData.employee_number}
                  onChange={(e) =>
                    handleInputChange('employee_number', e.target.value)
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) =>
                    handleInputChange('first_name', e.target.value)
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="middle_name">Middle Name</Label>
                <Input
                  id="middle_name"
                  value={formData.middle_name}
                  onChange={(e) =>
                    handleInputChange('middle_name', e.target.value)
                  }
                />
              </div>
              <div>
                <Label htmlFor="last_name">Last Name *</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) =>
                    handleInputChange('last_name', e.target.value)
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="date_of_birth">Date of Birth</Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) =>
                    handleInputChange('date_of_birth', e.target.value)
                  }
                />
              </div>
              <div>
                <Label htmlFor="gender">Gender</Label>
                <Select
                  value={formData.gender}
                  onValueChange={(value) => handleInputChange('gender', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="national_id">National ID</Label>
                <Input
                  id="national_id"
                  value={formData.national_id}
                  onChange={(e) =>
                    handleInputChange('national_id', e.target.value)
                  }
                />
              </div>
              <div>
                <Label htmlFor="kra_pin">KRA PIN</Label>
                <Input
                  id="kra_pin"
                  value={formData.kra_pin}
                  onChange={(e) => handleInputChange('kra_pin', e.target.value)}
                  placeholder="A000000000A"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Employment Details
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="job_title">Job Title</Label>
                <Input
                  id="job_title"
                  value={formData.job_title}
                  onChange={(e) =>
                    handleInputChange('job_title', e.target.value)
                  }
                />
              </div>
              <div>
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) =>
                    handleInputChange('department', e.target.value)
                  }
                />
              </div>
              <div>
                <Label htmlFor="hire_date">Hire Date *</Label>
                <Input
                  id="hire_date"
                  type="date"
                  value={formData.hire_date}
                  onChange={(e) =>
                    handleInputChange('hire_date', e.target.value)
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="employment_status">Employment Status</Label>
                <Select
                  value={formData.employment_status}
                  onValueChange={(value) =>
                    handleInputChange('employment_status', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="on_leave">On Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="contract_type">Contract Type</Label>
                <Select
                  value={formData.contract_type}
                  onValueChange={(value) =>
                    handleInputChange('contract_type', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select contract type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="permanent">Permanent</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="temporary">Temporary</SelectItem>
                    <SelectItem value="intern">Intern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="probation_end_date">Probation End Date</Label>
                <Input
                  id="probation_end_date"
                  type="date"
                  value={formData.probation_end_date}
                  onChange={(e) =>
                    handleInputChange('probation_end_date', e.target.value)
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financial" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Financial Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="basic_salary">Basic Salary (KES) *</Label>
                <Input
                  id="basic_salary"
                  type="number"
                  step="0.01"
                  value={formData.basic_salary}
                  onChange={(e) =>
                    handleInputChange('basic_salary', e.target.value)
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="nssf_number">NSSF Number</Label>
                <Input
                  id="nssf_number"
                  value={formData.nssf_number}
                  onChange={(e) =>
                    handleInputChange('nssf_number', e.target.value)
                  }
                />
              </div>
              <div>
                <Label htmlFor="nhif_number">NHIF Number</Label>
                <Input
                  id="nhif_number"
                  value={formData.nhif_number}
                  onChange={(e) =>
                    handleInputChange('nhif_number', e.target.value)
                  }
                />
              </div>
              <div>
                <Label htmlFor="bank_name">Bank Name</Label>
                <Input
                  id="bank_name"
                  value={formData.bank_name}
                  onChange={(e) =>
                    handleInputChange('bank_name', e.target.value)
                  }
                />
              </div>
              <div>
                <Label htmlFor="bank_account">Bank Account</Label>
                <Input
                  id="bank_account"
                  value={formData.bank_account}
                  onChange={(e) =>
                    handleInputChange('bank_account', e.target.value)
                  }
                />
              </div>
              <div>
                <Label htmlFor="bank_branch">Bank Branch</Label>
                <Input
                  id="bank_branch"
                  value={formData.bank_branch}
                  onChange={(e) =>
                    handleInputChange('bank_branch', e.target.value)
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="emergency_contact_name">
                  Emergency Contact Name
                </Label>
                <Input
                  id="emergency_contact_name"
                  value={formData.emergency_contact_name}
                  onChange={(e) =>
                    handleInputChange('emergency_contact_name', e.target.value)
                  }
                />
              </div>
              <div>
                <Label htmlFor="emergency_contact_phone">
                  Emergency Contact Phone
                </Label>
                <Input
                  id="emergency_contact_phone"
                  value={formData.emergency_contact_phone}
                  onChange={(e) =>
                    handleInputChange('emergency_contact_phone', e.target.value)
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end space-x-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading
            ? 'Saving...'
            : employee
              ? 'Update Employee'
              : 'Create Employee'}
        </Button>
      </div>
    </form>
  );
};
