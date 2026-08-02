import { apiFetch } from './api-client';

export type LeaveRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface LeaveType {
  id: string;
  name: string;
  daysPerYear: number;
  isPaid: boolean;
  isActive: boolean;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  daysRequested: number;
  reason: string | null;
  status: LeaveRequestStatus;
  decidedAt: string | null;
  createdAt: string;
  employee?: {
    firstName: string;
    lastName: string;
    employeeNumber: string | null;
  };
  leaveType?: {
    name: string;
  };
}

export interface LeaveBalance {
  id: string;
  leaveTypeId: string;
  year: number;
  accrued: number;
  used: number;
}

export function listLeaveTypes(): Promise<LeaveType[]> {
  return apiFetch<LeaveType[]>('/leave-types');
}

export function listLeaveRequests(filters?: {
  employeeId?: string;
  status?: LeaveRequestStatus;
}): Promise<LeaveRequest[]> {
  const params = new URLSearchParams();
  if (filters?.employeeId) params.set('employeeId', filters.employeeId);
  if (filters?.status) params.set('status', filters.status);
  const query = params.toString();
  return apiFetch<LeaveRequest[]>(`/leave-requests${query ? `?${query}` : ''}`);
}

export function listMyLeaveRequests(): Promise<LeaveRequest[]> {
  return apiFetch<LeaveRequest[]>('/leave-requests/mine');
}

export interface CreateLeaveRequestInput {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason?: string;
  employeeId?: string;
}

export function createLeaveRequest(
  input: CreateLeaveRequestInput,
): Promise<LeaveRequest> {
  return apiFetch<LeaveRequest>('/leave-requests', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function decideLeaveRequest(
  id: string,
  decision: 'APPROVED' | 'REJECTED',
): Promise<LeaveRequest> {
  return apiFetch<LeaveRequest>(`/leave-requests/${id}/decision`, {
    method: 'PATCH',
    body: JSON.stringify({ decision }),
  });
}

export function listLeaveBalances(
  employeeId: string,
  year?: number,
): Promise<LeaveBalance[]> {
  const query = year ? `?year=${year}` : '';
  return apiFetch<LeaveBalance[]>(
    `/employees/${employeeId}/leave-balances${query}`,
  );
}
