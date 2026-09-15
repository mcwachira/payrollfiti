import { apiFetch } from '@/lib/api-client';

export interface OnboardingTask {
  id: string;
  tenant_id: string;
  company_id: string;
  employee_id: string;
  title: string;
  description: string | null;
  status: 'pending' | 'completed';
  assigned_to: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskProgress {
  total: number;
  completed: number;
  pending: number;
  percentage: number;
}

export function listOnboardingTasks(employeeId?: string, status?: string): Promise<OnboardingTask[]> {
  const params = new URLSearchParams();
  if (employeeId) params.set('employee_id', employeeId);
  if (status) params.set('status', status);
  const query = params.toString();
  return apiFetch<OnboardingTask[]>(`/v1/onboarding/tasks${query ? `?${query}` : ''}`);
}

export function createOnboardingTask(data: { employee_id: string; title: string; description?: string }): Promise<OnboardingTask> {
  return apiFetch<OnboardingTask>('/v1/onboarding/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateOnboardingTask(id: string, status: 'pending' | 'completed'): Promise<OnboardingTask> {
  return apiFetch<OnboardingTask>(`/v1/onboarding/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

export function getTaskProgress(employeeId: string): Promise<TaskProgress> {
  return apiFetch<TaskProgress>(`/v1/onboarding/tasks?employee_id=${employeeId}`);
}
