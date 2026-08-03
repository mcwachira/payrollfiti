// @RequirePermission() is applied alongside @Roles() on every
// role-restricted controller — RolesGuard and PermissionsGuard both run as
// global guards (see app.module.ts) and are currently redundant (permissions
// are role-derived via ROLE_PERMISSIONS below), but consolidating onto one
// declared-permission model is what lets access control evolve without
// touching every controller's role list directly.
export enum Permission {
  EMPLOYEE_WRITE = 'employee:write',
  EMPLOYEE_TERMINATE = 'employee:terminate',
  PAYROLL_RUN = 'payroll:run',
  PAYROLL_CORRECT = 'payroll:correct',
  PAYROLL_READ = 'payroll:read',
  LEAVE_APPROVE = 'leave:approve',
  LEAVE_TYPE_MANAGE = 'leave-type:manage',
  DOCUMENT_DELETE = 'document:delete',
  BILLING_MANAGE = 'billing:manage',
  REPORTS_READ = 'reports:read',
  API_KEY_MANAGE = 'apikey:manage',
  WEBHOOK_MANAGE = 'webhook:manage',
  TENANT_MANAGE = 'tenant:manage',
  BRANDING_MANAGE = 'branding:manage',
  ATTENDANCE_MANAGE = 'attendance:manage',
  LOAN_MANAGE = 'loan:manage',
  SALARY_COMPONENT_MANAGE = 'salary-component:manage',
  AUDIT_LOG_READ = 'audit-log:read',
  BLOG_MANAGE = 'blog:manage',
}
