import type { PayrollRun } from '@/lib/payroll-api';
import type { Invoice } from '@/lib/billing-api';
import type { Loan } from '@/lib/loans-api';

const badgeColors = {
  green: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400',
  red: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400',
  yellow:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400',
  gray: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
} as const;

export function getPayrollStatusColor(status: PayrollRun['status']) {
  switch (status) {
    case 'COMPLETED':
      return badgeColors.green;
    case 'PROCESSING':
      return badgeColors.blue;
    case 'FAILED':
      return badgeColors.red;
    default:
      return badgeColors.gray;
  }
}

export function getEmployeeStatusColor(status: string) {
  switch (status) {
    case 'active':
      return badgeColors.green;
    case 'terminated':
      return badgeColors.red;
    case 'suspended':
      return badgeColors.yellow;
    case 'on_leave':
      return badgeColors.blue;
    case 'onboarding':
      return badgeColors.yellow;
    default:
      return badgeColors.gray;
  }
}

export function getInvoiceStatusColor(status: Invoice['status']) {
  switch (status) {
    case 'PAID':
      return badgeColors.green;
    case 'OPEN':
      return badgeColors.blue;
    case 'VOID':
    case 'UNCOLLECTIBLE':
      return badgeColors.red;
    default:
      return badgeColors.gray;
  }
}

export function getLoanStatusColor(status: Loan['status']) {
  switch (status) {
    case 'ACTIVE':
      return badgeColors.blue;
    case 'PAID_OFF':
      return badgeColors.green;
    case 'REJECTED':
      return badgeColors.red;
    default:
      return badgeColors.yellow;
  }
}
