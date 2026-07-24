export interface Employee {
  id: string; // UUID format
  first_name: string;
  middle_name?: string;
  last_name: string;
  employee_number: string;
  email: string;
  employment_status?: 'active' | 'on_leave' | 'terminated' | 'suspended' | string;
  gender?: 'Male' | 'Female' | 'Other' | string;
  date_of_birth?: string; // ISO date string (YYYY-MM-DD)
  phone?: string;
  national_id?: string;
  kra_pin?: string;
  job_title?: string;
  department?: string;
  probation_end_date?: string | Date;
  probation_start_date?: string | Date;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: number;
  nssf_number?: number;
  nhif_number?: number;
  bank_name?: string;
  contract_type?: string;
  bank_account?: number;
  bank_branch?: string;
  company_id?: string; // UUID format
  hire_date?: string; // ISO date string (YYYY-MM-DD)
  termination_date?: string | null;
  created_at?: string; // ISO datetime string
  updated_at?: string; // ISO datetime string
  basic_salary?: number;
}

export interface EmployeeDocument {
  id: string; // UUID
  employee_id: string | null; // UUID, nullable
  document_type: string; // Max 50 characters
  document_name: string; // Max 255 characters
  file_url: string; // URL to the file
  uploaded_by: string | null; // UUID, nullable
  uploaded_at: string; // ISO timestamp
}
