import EmployeeSelfService from '@/components/employee/EmployeeSelfService';

function EmployeePortal() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Employee Portal</h1>
        <p className="text-muted-foreground">
          Access your payslips, apply for leave, and manage your profile
        </p>
      </div>
      <EmployeeSelfService />
    </div>
  );
}

export default EmployeePortal;
