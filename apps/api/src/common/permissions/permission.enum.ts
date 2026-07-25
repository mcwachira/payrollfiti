// @RequirePermission() is applied only to sensitive endpoints — do not
// retrofit it onto the existing ~9 @Roles()-gated controllers; they're
// already correctly gated and that would be unreviewed churn for no
// behavioral gain. There are no @RequirePermission() call sites yet in this
// batch — Batch D adds the webhook/API-key-management endpoints that use it.
export enum Permission {
  EMPLOYEE_WRITE = 'employee:write',
  PAYROLL_RUN = 'payroll:run',
  PAYROLL_CORRECT = 'payroll:correct',
  LEAVE_APPROVE = 'leave:approve',
  DOCUMENT_DELETE = 'document:delete',
  BILLING_MANAGE = 'billing:manage',
  REPORTS_READ = 'reports:read',
  API_KEY_MANAGE = 'apikey:manage',
  WEBHOOK_MANAGE = 'webhook:manage',
}
