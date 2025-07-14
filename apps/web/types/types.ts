export interface Employee {
  id: string; // UUID format
  first_name: string;
  last_name: string;
  gender: 'Male' | 'Female' | 'Other' | string; // You can restrict values or keep it as string
  date_of_birth: string; // ISO date string (YYYY-MM-DD)
  email: string;
  phone: string;
  national_id: string;
  kra_pin: string;
  job_title: string;
  department: string;
  probation_end_date: Date;
  address: string;
  emergency_contact_name: string;
  emergency_contact_phone: number;
  nssf_number: number;
  nhif_number: number;
  bank_name: string;
  contract_type: string;
  probation_start_date: Date;
  bank_account: number;
  bank_branch: string;
  company_id: string; // UUID format
  employee_number: string;
  hire_date: string; // ISO date string (YYYY-MM-DD)
  termination_date: string | null; // Nullable or empty string if not terminated
  created_at: string; // ISO datetime string (YYYY-MM-DD HH:MM:SS)
  updated_at: string; // ISO datetime string (YYYY-MM-DD HH:MM:SS)
  basic_salary: number; // Decimal value as a number
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
