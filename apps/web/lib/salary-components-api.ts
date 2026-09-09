import { apiFetch } from './api-client';

export type SalaryComponentType = 'EARNING' | 'DEDUCTION';
export type SalaryComponentCalcType = 'FIXED' | 'PERCENTAGE_OF_BASIC';

export interface SalaryComponent {
  id: string;
  name: string;
  code: string;
  type: SalaryComponentType;
  calcType: SalaryComponentCalcType;
  isTaxable: boolean;
  isActive: boolean;
  defaultAmount: number | null;
  defaultRate: number | null;
}

export interface CreateSalaryComponentInput {
  name: string;
  code: string;
  type: SalaryComponentType;
  calcType?: SalaryComponentCalcType;
  isTaxable?: boolean;
  defaultAmount?: number;
  defaultRate?: number;
}

export function listSalaryComponents(
  activeOnly = true,
): Promise<SalaryComponent[]> {
  return apiFetch<SalaryComponent[]>(
    `/salary-components?activeOnly=${activeOnly}`,
  );
}

export function createSalaryComponent(
  input: CreateSalaryComponentInput,
): Promise<SalaryComponent> {
  return apiFetch<SalaryComponent>('/salary-components', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deactivateSalaryComponent(
  id: string,
): Promise<SalaryComponent> {
  return apiFetch<SalaryComponent>(`/salary-components/${id}`, {
    method: 'DELETE',
  });
}
