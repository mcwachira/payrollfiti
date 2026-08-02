import { apiFetch } from './api-client';

export interface Company {
  id: string;
  name: string;
  currency: string;
}

export interface Employee {
  id: string;
  companyId: string;
  employeeNumber: string | null;
  firstName: string;
  lastName: string;
  email: string;
  jobRole: string | null;
  employmentType: string;
  status: string;
  createdAt: string;
}

export interface CreateEmployeeInput {
  companyId: string;
  employeeNumber?: string;
  firstName: string;
  lastName: string;
  email: string;
  kraPin?: string;
  nssfNumber?: string;
  nhifNumber?: string;
  jobRole?: string;
  employmentType?: 'PERMANENT' | 'CONTRACT' | 'CASUAL' | 'INTERN';
  currency?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankCode?: string;
  bankBranchCode?: string;
}

export function listCompanies(): Promise<Company[]> {
  return apiFetch<Company[]>('/tenants/companies');
}

export function listEmployees(companyId: string): Promise<Employee[]> {
  return apiFetch<Employee[]>(
    `/employees?companyId=${encodeURIComponent(companyId)}`,
  );
}

export function getEmployee(id: string): Promise<Employee> {
  return apiFetch<Employee>(`/employees/${id}`);
}

export function createEmployee(input: CreateEmployeeInput): Promise<Employee> {
  return apiFetch<Employee>('/employees', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function removeEmployee(id: string): Promise<Employee> {
  return apiFetch<Employee>(`/employees/${id}`, { method: 'DELETE' });
}

export function updateEmployee(
  id: string,
  input: Partial<Omit<CreateEmployeeInput, 'companyId'>>,
): Promise<Employee> {
  return apiFetch<Employee>(`/employees/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export interface OnboardingTask {
  id: string;
  employeeId: string;
  title: string;
  isRequired: boolean;
  completed: boolean;
  completedAt: string | null;
  order: number;
}

export function listOnboardingTasks(
  employeeId: string,
): Promise<OnboardingTask[]> {
  return apiFetch<OnboardingTask[]>(
    `/employees/${employeeId}/onboarding-tasks`,
  );
}

export function addOnboardingTask(
  employeeId: string,
  input: { title: string; isRequired?: boolean },
): Promise<OnboardingTask> {
  return apiFetch<OnboardingTask>(
    `/employees/${employeeId}/onboarding-tasks`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function updateOnboardingTask(
  employeeId: string,
  taskId: string,
  completed: boolean,
): Promise<OnboardingTask> {
  return apiFetch<OnboardingTask>(
    `/employees/${employeeId}/onboarding-tasks/${taskId}`,
    { method: 'PATCH', body: JSON.stringify({ completed }) },
  );
}

export function completeOnboarding(employeeId: string): Promise<Employee> {
  return apiFetch<Employee>(`/employees/${employeeId}/onboarding/complete`, {
    method: 'POST',
  });
}

/** Bridges the API's Employee shape to the flat shape EmployeeList already renders */
export function toEmployeeListItem(employee: Employee) {
  return {
    id: employee.id,
    first_name: employee.firstName,
    last_name: employee.lastName,
    email: employee.email,
    employee_number: employee.employeeNumber ?? '—',
    job_title: employee.jobRole ?? undefined,
    department: undefined,
    employment_status: employee.status.toLowerCase(),
    hire_date: employee.createdAt,
  };
}
