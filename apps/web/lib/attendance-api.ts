import { apiFetch } from './api-client';

export type AttendanceStatus = 'present' | 'absent' | 'leave' | 'holiday';

export interface AttendanceRecord {
  id: string;
  companyId: string;
  employeeId: string;
  attendancePolicyId: string | null;
  attendanceDate: string;
  clockedInAt: string | null;
  clockedOutAt: string | null;
  regularHours: string | null;
  overtimeHours: string | null;
  status: AttendanceStatus;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export function listAttendanceRecords(
  companyId?: string,
): Promise<AttendanceRecord[]> {
  const qs = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
  return apiFetch<AttendanceRecord[]>(`/v1/attendance/records${qs}`);
}

export function getAttendanceRecord(id: string): Promise<AttendanceRecord> {
  return apiFetch<AttendanceRecord>(`/v1/attendance/records/${id}`);
}

export function clockIn(): Promise<AttendanceRecord> {
  return apiFetch<AttendanceRecord>('/v1/attendance/records/clock-in', {
    method: 'POST',
  });
}

export function clockOut(id: string): Promise<AttendanceRecord> {
  return apiFetch<AttendanceRecord>(
    `/v1/attendance/records/${id}/clock-out`,
    {
      method: 'POST',
    },
  );
}

export function markHoliday(input: {
  companyId: string;
  attendanceDate: string;
}): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(
    '/v1/attendance/records/mark-holiday',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function markAbsent(input: {
  companyId: string;
  employeeId: string;
  attendanceDate: string;
}): Promise<AttendanceRecord> {
  return apiFetch<AttendanceRecord>('/v1/attendance/records/mark-absent', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
