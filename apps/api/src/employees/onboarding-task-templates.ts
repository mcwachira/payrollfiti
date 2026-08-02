export interface OnboardingTaskTemplate {
  title: string;
  isRequired: boolean;
}

const UNIVERSAL_TASKS: OnboardingTaskTemplate[] = [
  { title: 'Signed employment contract on file', isRequired: true },
  { title: 'Bank details verified', isRequired: true },
  { title: 'Salary structure configured', isRequired: true },
  { title: 'IT equipment and system access provisioned', isRequired: false },
];

/** Country-specific statutory IDs that must be collected before payroll can run correctly. */
const COUNTRY_TASKS: Record<string, OnboardingTaskTemplate[]> = {
  KE: [
    { title: 'KRA PIN collected', isRequired: true },
    { title: 'NSSF number collected', isRequired: true },
    { title: 'NHIF/SHIF number collected', isRequired: true },
  ],
  NG: [
    { title: 'Tax Identification Number (TIN) collected', isRequired: true },
    { title: 'Pension RSA PIN collected', isRequired: true },
  ],
  ZA: [
    { title: 'SARS Income Tax reference number collected', isRequired: true },
  ],
};

/** Default onboarding checklist for a newly-created employee, seeded on Employee.create. */
export function getDefaultOnboardingTasks(
  countryCode: string,
): OnboardingTaskTemplate[] {
  return [
    ...UNIVERSAL_TASKS,
    ...(COUNTRY_TASKS[countryCode.toUpperCase()] ?? []),
  ];
}
