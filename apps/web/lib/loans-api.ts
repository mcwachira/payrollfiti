import { apiFetch } from './api-client';

export type LoanStatus = 'PENDING' | 'REJECTED' | 'ACTIVE' | 'PAID_OFF';
export type LoanRepaymentStatus = 'PENDING' | 'PAID' | 'SKIPPED';

export interface LoanRepayment {
  id: string;
  loanId: string;
  installmentNo: number;
  period: string;
  amountDue: number;
  amountPaid: number;
  status: LoanRepaymentStatus;
  paidAt: string | null;
}

export interface Loan {
  id: string;
  employeeId: string;
  principal: number;
  currency: string;
  installments: number;
  installmentAmount: number | null;
  startPeriod: string;
  reason: string | null;
  status: LoanStatus;
  decidedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  repayments?: LoanRepayment[];
  balance?: number;
  employee?: {
    firstName: string;
    lastName: string;
    employeeNumber: string | null;
  };
}

export function listLoans(filters?: {
  employeeId?: string;
  status?: LoanStatus;
}): Promise<Loan[]> {
  const params = new URLSearchParams();
  if (filters?.employeeId) params.set('employeeId', filters.employeeId);
  if (filters?.status) params.set('status', filters.status);
  const query = params.toString();
  return apiFetch<Loan[]>(`/loans${query ? `?${query}` : ''}`);
}

export function listMyLoans(): Promise<Loan[]> {
  return apiFetch<Loan[]>('/loans/mine');
}

export function getLoan(id: string): Promise<Loan> {
  return apiFetch<Loan>(`/loans/${id}`);
}

export interface CreateLoanInput {
  employeeId: string;
  principal: number;
  installments: number;
  /** "YYYY-MM" — first payroll period the deduction applies from, once approved */
  startPeriod: string;
  reason?: string;
}

export function createLoan(input: CreateLoanInput): Promise<Loan> {
  return apiFetch<Loan>('/loans', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function decideLoan(
  id: string,
  decision: 'APPROVED' | 'REJECTED',
  reason?: string,
): Promise<Loan> {
  return apiFetch<Loan>(`/loans/${id}/decision`, {
    method: 'PATCH',
    body: JSON.stringify({ decision, reason }),
  });
}

export function payoffLoan(id: string, note?: string): Promise<Loan> {
  return apiFetch<Loan>(`/loans/${id}/payoff`, {
    method: 'PATCH',
    body: JSON.stringify({ note }),
  });
}
