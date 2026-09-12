<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DemoDataSeeder extends Seeder
{
    private const PASSWORD = 'PayrollFitiDemo!2026';

    private array $tenants = [];
    private array $companies = [];
    private array $users = [];
    private array $employees = [];
    private array $departments = [];
    private array $positions = [];
    private array $workLocations = [];
    private array $salaryComponents = [];
    private array $salaryStructures = [];
    private array $leaveTypes = [];
    private array $loanProducts = [];
    private array $plans = [];
    private array $subscriptions = [];
    private array $payrollPeriods = [];
    private array $payrollEntries = [];

    public function run(): void
    {
        DB::transaction(function (): void {
            $this->seedReferenceData();
            $this->seedTenantsAndCompanies();
            $this->seedUsersAndAuthorization();
            $this->seedPeopleAndCompensation();
            $this->seedPayroll();
            $this->seedLeaveLoansAndAttendance();
            $this->seedDocuments();
            $this->seedBillingAndPayments();
            $this->seedNotificationsWebhooksAndApiKeys();
            $this->seedAccountingAndOperations();
        });

        DB::statement("RESET app.current_tenant_id");
    }

    private function seedReferenceData(): void
    {
        $now = now();

        foreach ([
            ['id' => $this->id('plan-starter'), 'name' => 'Starter', 'slug' => 'starter', 'description' => 'For small teams getting started with payroll.', 'monthly_price' => '2500.00', 'annual_price' => '27000.00', 'included_employees' => 25, 'features' => ['payroll', 'leave', 'employee_records']],
            ['id' => $this->id('plan-professional'), 'name' => 'Professional', 'slug' => 'professional', 'description' => 'Payroll and HR operations for growing companies.', 'monthly_price' => '8500.00', 'annual_price' => '91800.00', 'included_employees' => 100, 'features' => ['payroll', 'leave', 'loans', 'attendance', 'reports']],
            ['id' => $this->id('plan-enterprise'), 'name' => 'Enterprise', 'slug' => 'enterprise', 'description' => 'Advanced controls for larger organizations.', 'monthly_price' => '25000.00', 'annual_price' => '270000.00', 'included_employees' => 500, 'features' => ['all']],
        ] as $plan) {
            $planData = $plan;
            $planData['features'] = json_encode($plan['features']);
            $planData['status'] = 'active';
            $planData['created_at'] = $now;
            $planData['updated_at'] = $now;
            unset($planData['key']);
            $this->upsert('plans', $plan['id'], $planData);
            $this->plans[$plan['slug']] = $plan['id'];
        }

        $ruleSetId = $this->id('rules-ke-2025');
        $this->upsert('statutory_rule_sets', $ruleSetId, [
            'country' => 'KE',
            'name' => 'Kenya statutory rules',
            'version' => 'KE-2025',
            'effective_from' => '2025-01-01',
            'status' => 'active',
            'configuration' => json_encode(['currency' => 'KES', 'notes' => 'Development reference configuration']),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        foreach ([
            ['code' => 'PAYE', 'name' => 'Pay As You Earn', 'type' => 'tax', 'configuration' => ['country' => 'KE']],
            ['code' => 'NSSF', 'name' => 'NSSF employee contribution', 'type' => 'deduction', 'configuration' => ['country' => 'KE']],
            ['code' => 'SHIF', 'name' => 'Social Health Insurance Fund', 'type' => 'deduction', 'configuration' => ['effective_from' => '2024-10-01']],
        ] as $rule) {
            $this->upsert('statutory_rules', $this->id('rule-' . $rule['code']), [
                'rule_set_id' => $ruleSetId,
                'code' => $rule['code'],
                'name' => $rule['name'],
                'type' => $rule['type'],
                'configuration' => json_encode($rule['configuration']),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    private function seedTenantsAndCompanies(): void
    {
        $now = now();
        $definitions = [
            ['key' => 'kenya', 'name' => 'Imara Foods Group', 'slug' => 'imara-foods', 'subdomain' => 'imara', 'company' => 'Imara Foods Kenya Ltd', 'registration' => 'C-DEV-KE-001'],
            ['key' => 'uganda', 'name' => 'Savanna Logistics Group', 'slug' => 'savanna-logistics', 'subdomain' => 'savanna', 'company' => 'Savanna Logistics Uganda Ltd', 'registration' => 'C-DEV-UG-001'],
        ];

        foreach ($definitions as $definition) {
            $tenantId = $this->id('tenant-' . $definition['key']);
            $companyId = $this->id('company-' . $definition['key']);

            $this->upsert('tenants', $tenantId, [
                'name' => $definition['name'],
                'slug' => $definition['slug'],
                'subdomain' => $definition['subdomain'],
                'default_country' => $definition['key'] === 'kenya' ? 'KE' : 'UG',
                'default_currency' => $definition['key'] === 'kenya' ? 'KES' : 'UGX',
                'branding' => json_encode(['accent_color' => $definition['key'] === 'kenya' ? '#0F766E' : '#1D4ED8']),
                'status' => 'active',
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            $this->tenants[$definition['key']] = $tenantId;
            $this->setTenant($tenantId);

            $this->upsert('companies', $companyId, [
                'tenant_id' => $tenantId,
                'name' => $definition['company'],
                'legal_name' => $definition['company'],
                'registration_number' => $definition['registration'],
                'tax_number' => 'TAX-DEV-' . strtoupper($definition['key']),
                'country' => $definition['key'] === 'kenya' ? 'KE' : 'UG',
                'currency' => $definition['key'] === 'kenya' ? 'KES' : 'UGX',
                'email' => 'finance@' . $definition['subdomain'] . '.payrollfiti.test',
                'phone' => $definition['key'] === 'kenya' ? '+254700000001' : '+256700000001',
                'address' => json_encode(['city' => $definition['key'] === 'kenya' ? 'Nairobi' : 'Kampala', 'country' => $definition['key'] === 'kenya' ? 'KE' : 'UG']),
                'status' => 'active',
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            $this->companies[$definition['key']] = $companyId;
            $this->upsert('subscriptions', $this->id('subscription-' . $definition['key']), [
                'tenant_id' => $tenantId,
                'plan_id' => $this->plans[$definition['key'] === 'kenya' ? 'professional' : 'starter'],
                'status' => 'active',
                'starts_at' => '2026-01-01 00:00:00+00',
                'provider' => 'development',
                'provider_subscription_id' => 'dev-sub-' . $definition['key'],
                'metadata' => json_encode(['seeded' => true]),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    private function seedUsersAndAuthorization(): void
    {
        $now = now();
        $permissions = [
            'employees.view', 'employees.manage', 'payroll.view', 'payroll.manage',
            'leave.view', 'leave.manage', 'loans.manage', 'attendance.manage',
            'billing.view', 'reports.view',
        ];

        foreach ($permissions as $permission) {
            $this->upsert('permissions', $this->id('permission-' . $permission), [
                'name' => $permission,
                'slug' => $permission,
                'domain' => explode('.', $permission)[0],
                'description' => 'Development permission for ' . $permission,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        foreach ($this->tenants as $tenantKey => $tenantId) {
            $this->setTenant($tenantId);
            $roles = [
                'tenant-admin' => ['name' => 'Tenant Admin', 'permissions' => $permissions],
                'hr-manager' => ['name' => 'HR Manager', 'permissions' => ['employees.view', 'employees.manage', 'leave.view', 'leave.manage', 'attendance.manage']],
                'payroll-manager' => ['name' => 'Payroll Manager', 'permissions' => ['employees.view', 'payroll.view', 'payroll.manage', 'reports.view']],
                'employee' => ['name' => 'Employee', 'permissions' => ['employees.view', 'leave.view']],
            ];

            foreach ($roles as $slug => $role) {
                $roleId = $this->id('role-' . $tenantKey . '-' . $slug);
                $this->upsert('roles', $roleId, [
                    'tenant_id' => $tenantId,
                    'name' => $role['name'],
                    'slug' => $slug,
                    'description' => 'Development role',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                foreach ($role['permissions'] as $permission) {
                    DB::table('role_permissions')->updateOrInsert([
                        'role_id' => $roleId,
                        'permission_id' => $this->id('permission-' . $permission),
                    ], []);
                }
            }

            foreach ([
                ['key' => 'admin', 'name' => 'Tenant Administrator', 'email' => 'admin@' . $tenantKey . '.payrollfiti.test', 'role' => 'tenant-admin'],
                ['key' => 'payroll', 'name' => 'Payroll Manager', 'email' => 'payroll@' . $tenantKey . '.payrollfiti.test', 'role' => 'payroll-manager'],
                ['key' => 'hr', 'name' => 'HR Manager', 'email' => 'hr@' . $tenantKey . '.payrollfiti.test', 'role' => 'hr-manager'],
            ] as $definition) {
                $userId = $this->id('user-' . $tenantKey . '-' . $definition['key']);
                $this->upsert('users', $userId, [
                    'tenant_id' => $tenantId,
                    'name' => $definition['name'],
                    'email' => $definition['email'],
                    'email_verified_at' => $now,
                    'password' => Hash::make(self::PASSWORD),
                    'status' => 'active',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                $this->users[$tenantKey . '-' . $definition['key']] = $userId;
                DB::table('user_roles')->updateOrInsert([
                    'user_id' => $userId,
                    'role_id' => $this->id('role-' . $tenantKey . '-' . $definition['role']),
                ], []);
            }
        }
    }

    private function seedPeopleAndCompensation(): void
    {
        $now = now();
        $ruleSetId = $this->id('rules-ke-2025');

        foreach ($this->tenants as $tenantKey => $tenantId) {
            $this->setTenant($tenantId);
            $companyId = $this->companies[$tenantKey];
            $currency = $tenantKey === 'kenya' ? 'KES' : 'UGX';

            foreach (['Operations', 'Finance', 'People'] as $index => $name) {
                $departmentId = $this->id("department-$tenantKey-$index");
                $this->departments[$tenantKey][$name] = $departmentId;
                $this->upsert('departments', $departmentId, [
                    'company_id' => $companyId, 'name' => $name, 'code' => strtoupper(substr($name, 0, 3)),
                    'created_at' => $now, 'updated_at' => $now, 'tenant_id' => $tenantId,
                ]);
            }

            foreach (['Analyst', 'Officer', 'Supervisor', 'Coordinator'] as $index => $name) {
                $positionId = $this->id("position-$tenantKey-$index");
                $this->positions[$tenantKey][$name] = $positionId;
                $this->upsert('positions', $positionId, [
                    'company_id' => $companyId, 'department_id' => $this->departments[$tenantKey]['Operations'],
                    'name' => $name, 'code' => 'POS-' . ($index + 1), 'created_at' => $now, 'updated_at' => $now, 'tenant_id' => $tenantId,
                ]);
            }

            $locationId = $this->id("location-$tenantKey");
            $this->workLocations[$tenantKey] = $locationId;
            $this->upsert('work_locations', $locationId, [
                'company_id' => $companyId, 'name' => $tenantKey === 'kenya' ? 'Nairobi Office' : 'Kampala Office',
                'address' => json_encode(['city' => $tenantKey === 'kenya' ? 'Nairobi' : 'Kampala']),
                'created_at' => $now, 'updated_at' => $now, 'tenant_id' => $tenantId,
            ]);

            foreach ([
                ['code' => 'BASIC', 'name' => 'Basic Salary', 'type' => 'earning', 'taxable' => true],
                ['code' => 'HOUSE', 'name' => 'Housing Allowance', 'type' => 'earning', 'taxable' => true],
                ['code' => 'TRANS', 'name' => 'Transport Allowance', 'type' => 'earning', 'taxable' => true],
                ['code' => 'PAYE', 'name' => 'PAYE', 'type' => 'deduction', 'statutory' => true],
                ['code' => 'NSSF', 'name' => 'NSSF', 'type' => 'deduction', 'statutory' => true],
                ['code' => 'SHIF', 'name' => 'SHIF', 'type' => 'deduction', 'statutory' => true],
            ] as $component) {
                $componentId = $this->id("component-$tenantKey-" . $component['code']);
                $this->salaryComponents[$tenantKey][$component['code']] = $componentId;
                $this->upsert('salary_components', $componentId, [
                    'company_id' => $companyId, 'name' => $component['name'], 'code' => $component['code'],
                    'type' => $component['type'], 'calculation_type' => $component['code'] === 'BASIC' ? 'fixed' : 'percentage',
                    'taxable' => $component['taxable'] ?? false, 'statutory' => $component['statutory'] ?? false,
                    'configuration' => json_encode(['seeded' => true]), 'created_at' => $now, 'updated_at' => $now, 'tenant_id' => $tenantId,
                ]);
            }

            $structureId = $this->id("salary-structure-$tenantKey");
            $this->salaryStructures[$tenantKey] = $structureId;
            $this->upsert('salary_structures', $structureId, [
                'company_id' => $companyId, 'name' => 'Standard Monthly Salary', 'code' => 'STANDARD-MONTHLY',
                'currency' => $currency, 'active' => true, 'created_at' => $now, 'updated_at' => $now, 'tenant_id' => $tenantId,
            ]);
            foreach (['BASIC' => '65000.00', 'HOUSE' => '12000.00', 'TRANS' => '6000.00'] as $code => $amount) {
                $this->upsert('salary_structure_components', $this->id("structure-component-$tenantKey-$code"), [
                    'salary_structure_id' => $structureId, 'salary_component_id' => $this->salaryComponents[$tenantKey][$code],
                    'amount' => $amount, 'percentage' => null, 'configuration' => json_encode([]), 'sort_order' => 1,
                    'created_at' => $now, 'updated_at' => $now, 'tenant_id' => $tenantId,
                ]);
            }

            $this->upsert('payroll_settings', $this->id("payroll-settings-$tenantKey"), [
                'company_id' => $companyId, 'frequency' => 'monthly', 'currency' => $currency,
                'default_rule_set_id' => $tenantKey === 'kenya' ? $ruleSetId : null,
                'configuration' => json_encode(['timezone' => $tenantKey === 'kenya' ? 'Africa/Nairobi' : 'Africa/Kampala']),
                'created_at' => $now, 'updated_at' => $now, 'tenant_id' => $tenantId,
            ]);

            for ($index = 1; $index <= 10; $index++) {
                $employeeId = $this->id("employee-$tenantKey-$index");
                $department = $index % 3 === 0 ? 'Finance' : 'Operations';
                $position = ['Analyst', 'Officer', 'Supervisor', 'Coordinator'][$index % 4];
                $salary = 55000 + ($index * 3500);
                $this->employees[$tenantKey][] = $employeeId;
                $this->upsert('employees', $employeeId, [
                    'tenant_id' => $tenantId, 'company_id' => $companyId, 'department_id' => $this->departments[$tenantKey][$department],
                    'position_id' => $this->positions[$tenantKey][$position], 'work_location_id' => $locationId,
                    'salary_structure_id' => $structureId, 'employee_number' => strtoupper(substr($tenantKey, 0, 2)) . sprintf('%04d', $index),
                    'first_name' => ['Amina', 'Brian', 'Cynthia', 'David', 'Esther', 'Farah', 'George', 'Hawa', 'Ibrahim', 'Joy'][$index - 1],
                    'middle_name' => null, 'last_name' => ['Otieno', 'Kato', 'Wanjiku', 'Mwangi', 'Nabwire', 'Kamau', 'Okello', 'Njeri', 'Ouma', 'Achieng'][$index - 1],
                    'email' => 'employee' . $index . '@' . $tenantKey . '.payrollfiti.test',
                    'phone' => $tenantKey === 'kenya' ? '+254711000' . str_pad((string) $index, 3, '0', STR_PAD_LEFT) : '+256751000' . str_pad((string) $index, 3, '0', STR_PAD_LEFT),
                    'country' => $tenantKey === 'kenya' ? 'KE' : 'UG', 'hire_date' => '2024-01-' . str_pad((string) (($index % 28) + 1), 2, '0', STR_PAD_LEFT),
                    'status' => $index === 10 ? 'on_leave' : 'active', 'date_of_birth' => '1990-0' . (($index % 8) + 1) . '-' . str_pad((string) (($index % 20) + 1), 2, '0', STR_PAD_LEFT),
                    'gender' => $index % 2 === 0 ? 'female' : 'male', 'created_at' => $now, 'updated_at' => $now,
                ]);
                $this->upsert('employee_employment_history', $this->id("employment-$tenantKey-$index"), [
                    'employee_id' => $employeeId, 'department_id' => $this->departments[$tenantKey][$department], 'position_id' => $this->positions[$tenantKey][$position],
                    'effective_from' => '2024-01-01', 'employment_type' => 'full_time', 'created_at' => $now, 'updated_at' => $now, 'tenant_id' => $tenantId,
                ]);
                $this->upsert('employee_compensation_history', $this->id("compensation-$tenantKey-$index"), [
                    'employee_id' => $employeeId, 'salary_structure_id' => $structureId, 'base_salary' => number_format($salary, 2, '.', ''),
                    'currency' => $currency, 'effective_from' => '2024-01-01', 'snapshot' => json_encode(['basic_salary' => $salary]),
                    'created_at' => $now, 'updated_at' => $now, 'tenant_id' => $tenantId,
                ]);
                $this->upsert('employee_bank_accounts', $this->id("bank-$tenantKey-$index"), [
                    'employee_id' => $employeeId, 'bank_name' => 'Development Commercial Bank', 'account_name' => 'Demo Employee ' . $index,
                    'account_number_encrypted' => hash('sha256', '000000' . $index), 'branch_code' => 'DEV001', 'is_primary' => true,
                    'created_at' => $now, 'updated_at' => $now, 'tenant_id' => $tenantId,
                ]);
                $this->upsert('employee_tax_profiles', $this->id("tax-$tenantKey-$index"), [
                    'employee_id' => $employeeId, 'tax_number_encrypted' => hash('sha256', 'TAX-DEV-' . $tenantKey . '-' . $index),
                    'configuration' => json_encode(['residency' => 'resident']), 'created_at' => $now, 'updated_at' => $now, 'tenant_id' => $tenantId,
                ]);
                $this->upsert('employee_dependants', $this->id("dependant-$tenantKey-$index"), [
                    'employee_id' => $employeeId, 'first_name' => 'Demo', 'last_name' => 'Dependant',
                    'relationship' => 'child', 'date_of_birth' => '2018-05-10', 'created_at' => $now, 'updated_at' => $now, 'tenant_id' => $tenantId,
                ]);
                $this->upsert('employee_emergency_contacts', $this->id("emergency-$tenantKey-$index"), [
                    'employee_id' => $employeeId, 'name' => 'Emergency Contact ' . $index, 'relationship' => 'sibling',
                    'phone' => '+254700100' . str_pad((string) $index, 3, '0', STR_PAD_LEFT), 'created_at' => $now, 'updated_at' => $now, 'tenant_id' => $tenantId,
                ]);
                $this->upsert('onboarding_tasks', $this->id("onboarding-$tenantKey-$index"), [
                    'employee_id' => $employeeId, 'title' => 'Complete payroll profile', 'description' => 'Development onboarding task',
                    'status' => $index % 3 === 0 ? 'completed' : 'pending', 'assigned_to' => $this->users[$tenantKey . '-hr'],
                    'completed_at' => $index % 3 === 0 ? '2024-01-15 12:00:00+00' : null, 'created_at' => $now, 'updated_at' => $now, 'tenant_id' => $tenantId,
                ]);
            }
        }
    }

    private function seedPayroll(): void
    {
        $now = now();
        foreach ($this->tenants as $tenantKey => $tenantId) {
            $this->setTenant($tenantId);
            $companyId = $this->companies[$tenantKey];
            $currency = $tenantKey === 'kenya' ? 'KES' : 'UGX';
            $scheduleId = $this->id("schedule-$tenantKey");
            $this->upsert('pay_schedules', $scheduleId, [
                'company_id' => $companyId, 'name' => 'Monthly payroll', 'frequency' => 'monthly', 'pay_day' => 25,
                'active' => true, 'created_at' => $now, 'updated_at' => $now, 'tenant_id' => $tenantId,
            ]);

            foreach ([['key' => 'previous', 'start' => '2026-08-01', 'end' => '2026-08-31', 'pay' => '2026-08-25'], ['key' => 'current', 'start' => '2026-09-01', 'end' => '2026-09-30', 'pay' => '2026-09-25']] as $period) {
                $periodId = $this->id("period-$tenantKey-" . $period['key']);
                $this->payrollPeriods[$tenantKey][$period['key']] = $periodId;
                $this->upsert('payroll_periods', $periodId, [
                    'company_id' => $companyId, 'pay_schedule_id' => $scheduleId, 'period_start' => $period['start'],
                    'period_end' => $period['end'], 'pay_date' => $period['pay'], 'status' => $period['key'] === 'previous' ? 'closed' : 'open',
                    'created_at' => $now, 'updated_at' => $now, 'tenant_id' => $tenantId,
                ]);
                $runId = $this->id("run-$tenantKey-" . $period['key']);
                $this->upsert('payroll_runs', $runId, [
                    'tenant_id' => $tenantId, 'company_id' => $companyId, 'payroll_period_id' => $periodId,
                    'period_start' => $period['start'], 'period_end' => $period['end'], 'pay_date' => $period['pay'],
                    'status' => $period['key'] === 'previous' ? 'completed' : 'draft',
                    'input_hash' => hash('sha256', 'seed|' . $tenantKey . '|' . $period['key']),
                    'rule_set_id' => $tenantKey === 'kenya' ? $this->id('rules-ke-2025') : null,
                    'rule_version' => $tenantKey === 'kenya' ? 'KE-2025' : 'UG-DEMO-2026',
                    'initiated_by' => $this->users[$tenantKey . '-payroll'],
                    'approved_by' => $period['key'] === 'previous' ? $this->users[$tenantKey . '-admin'] : null,
                    'approved_at' => $period['key'] === 'previous' ? '2026-08-24 09:00:00+00' : null,
                    'finalized_by' => $period['key'] === 'previous' ? $this->users[$tenantKey . '-payroll'] : null,
                    'finalized_at' => $period['key'] === 'previous' ? '2026-08-24 10:00:00+00' : null,
                    'input_snapshot' => json_encode(['currency' => $currency, 'seeded' => true]), 'created_at' => $now, 'updated_at' => $now,
                ]);

                foreach ($this->employees[$tenantKey] as $index => $employeeId) {
                    $gross = 73000 + (($index + 1) * 3500);
                    $deductions = round($gross * 0.12, 2);
                    $entryId = $this->id("entry-$tenantKey-" . $period['key'] . '-' . ($index + 1));
                    $this->payrollEntries[$tenantKey][$period['key']][$index] = $entryId;
                    $this->upsert('payroll_entries', $entryId, [
                        'tenant_id' => $tenantId, 'payroll_run_id' => $runId, 'employee_id' => $employeeId,
                        'gross_pay' => number_format($gross, 2, '.', ''), 'taxable_pay' => number_format($gross, 2, '.', ''),
                        'total_deductions' => number_format($deductions, 2, '.', ''), 'employer_contributions' => '500.00',
                        'net_pay' => number_format($gross - $deductions, 2, '.', ''),
                        'breakdown' => json_encode(['basic' => $gross - 18000, 'housing' => 12000, 'transport' => 6000, 'deductions' => $deductions]),
                        'created_at' => $now,
                    ]);
                    foreach (['BASIC' => $gross - 18000, 'HOUSE' => 12000, 'TRANS' => 6000] as $code => $amount) {
                        $this->upsert('payroll_entry_items', $this->id("entry-item-$tenantKey-{$period['key']}-$index-$code"), [
                            'payroll_entry_id' => $entryId, 'salary_component_id' => $this->salaryComponents[$tenantKey][$code],
                            'code' => $code, 'name' => $code === 'BASIC' ? 'Basic Salary' : ($code === 'HOUSE' ? 'Housing Allowance' : 'Transport Allowance'),
                            'type' => 'earning', 'amount' => number_format($amount, 2, '.', ''), 'calculation_metadata' => json_encode(['seeded' => true]),
                            'created_at' => $now, 'updated_at' => $now, 'tenant_id' => $tenantId,
                        ]);
                    }
                    if ($period['key'] === 'previous') {
                        $this->upsert('payslips', $this->id("payslip-$tenantKey-$index"), [
                            'tenant_id' => $tenantId, 'payroll_entry_id' => $entryId, 'payslip_number' => strtoupper(substr($tenantKey, 0, 2)) . '-2026-08-' . sprintf('%04d', $index + 1),
                            'status' => 'generated', 'storage_disk' => 'local', 'storage_path' => 'seed/payslips/' . $entryId . '.pdf',
                            'file_hash' => hash('sha256', $entryId), 'generated_at' => '2026-08-25 12:00:00+00', 'created_at' => $now, 'updated_at' => $now,
                        ]);
                    }
                }
            }
        }
    }

    private function seedLeaveLoansAndAttendance(): void
    {
        $now = now();
        foreach ($this->tenants as $tenantKey => $tenantId) {
            $this->setTenant($tenantId);
            $companyId = $this->companies[$tenantKey];
            foreach ([
                ['code' => 'ANNUAL', 'name' => 'Annual Leave', 'days' => '21.00', 'paid' => true, 'carry' => true],
                ['code' => 'SICK', 'name' => 'Sick Leave', 'days' => '14.00', 'paid' => true, 'carry' => false],
                ['code' => 'UNPAID', 'name' => 'Unpaid Leave', 'days' => '0.00', 'paid' => false, 'carry' => false],
            ] as $leave) {
                $leaveTypeId = $this->id("leave-type-$tenantKey-" . $leave['code']);
                $this->leaveTypes[$tenantKey][$leave['code']] = $leaveTypeId;
                $this->upsert('leave_types', $leaveTypeId, [
                    'tenant_id' => $tenantId, 'company_id' => $companyId, 'name' => $leave['name'], 'code' => $leave['code'],
                    'description' => 'Development leave type', 'default_days_per_year' => $leave['days'], 'accrual_type' => 'annual',
                    'approval_type' => 'manager', 'is_paid' => $leave['paid'], 'allow_carry_forward' => $leave['carry'],
                    'maximum_carry_forward_days' => $leave['carry'] ? '10.00' : null, 'requires_document' => $leave['code'] === 'SICK',
                    'is_active' => true, 'rules' => json_encode([]), 'created_at' => $now, 'updated_at' => $now,
                ]);
            }

            $policyId = $this->id("attendance-policy-$tenantKey");
            $this->upsert('attendance_policies', $policyId, [
                'tenant_id' => $tenantId, 'company_id' => $companyId, 'name' => 'Standard office schedule',
                'timezone' => $tenantKey === 'kenya' ? 'Africa/Nairobi' : 'Africa/Kampala',
                'schedule' => json_encode(['monday' => ['start' => '08:00', 'end' => '17:00'], 'friday' => ['start' => '08:00', 'end' => '16:00']]),
                'grace_minutes' => 15, 'active' => true, 'created_at' => $now, 'updated_at' => $now,
            ]);
            $loanProductId = $this->id("loan-product-$tenantKey");
            $this->loanProducts[$tenantKey] = $loanProductId;
            $this->upsert('loan_products', $loanProductId, [
                'tenant_id' => $tenantId, 'company_id' => $companyId, 'name' => 'Staff Emergency Advance', 'code' => 'STAFF-ADVANCE',
                'maximum_principal' => '300000.00', 'annual_interest_rate' => '8.0000', 'maximum_term_months' => 12,
                'active' => true, 'rules' => json_encode(['repayment_method' => 'payroll_deduction']), 'created_at' => $now, 'updated_at' => $now,
            ]);

            foreach ($this->employees[$tenantKey] as $index => $employeeId) {
                $leaveBalanceId = $this->id("leave-balance-$tenantKey-" . ($index + 1));
                $used = $index === 0 ? '3.00' : '0.00';
                $pending = $index === 1 ? '2.00' : '0.00';
                $this->upsert('leave_balances', $leaveBalanceId, [
                    'tenant_id' => $tenantId, 'company_id' => $companyId, 'employee_id' => $employeeId, 'leave_type_id' => $this->leaveTypes[$tenantKey]['ANNUAL'],
                    'year' => 2026, 'allocated_days' => '21.00', 'carried_forward_days' => '2.00', 'used_days' => $used,
                    'pending_days' => $pending, 'available_days' => number_format(23 - (float) $used - (float) $pending, 2, '.', ''),
                    'created_at' => $now, 'updated_at' => $now,
                ]);
                if ($index < 3) {
                    $requestId = $this->id("leave-request-$tenantKey-" . ($index + 1));
                    $status = ['approved', 'pending', 'rejected'][$index];
                    $this->upsert('leave_requests', $requestId, [
                        'tenant_id' => $tenantId, 'company_id' => $companyId, 'employee_id' => $employeeId,
                        'leave_type_id' => $this->leaveTypes[$tenantKey]['ANNUAL'], 'submitted_by' => $this->users[$tenantKey . '-hr'],
                        'start_date' => '2026-10-' . str_pad((string) (5 + $index * 3), 2, '0', STR_PAD_LEFT),
                        'end_date' => '2026-10-' . str_pad((string) (6 + $index * 3), 2, '0', STR_PAD_LEFT),
                        'days_requested' => '2.00', 'reason' => 'Development leave scenario', 'status' => $status,
                        'approved_at' => $status === 'approved' ? '2026-09-01 10:00:00+00' : null, 'created_at' => $now, 'updated_at' => $now,
                    ]);
                    $this->upsert('leave_approvals', $this->id("leave-approval-$tenantKey-" . ($index + 1)), [
                        'tenant_id' => $tenantId, 'leave_request_id' => $requestId, 'approver_id' => $this->users[$tenantKey . '-hr'],
                        'status' => $status, 'comments' => 'Development approval workflow', 'decided_at' => $status === 'pending' ? null : '2026-09-01 10:00:00+00',
                        'created_at' => $now, 'updated_at' => $now,
                    ]);
                }
                for ($day = 1; $day <= 3; $day++) {
                    $date = '2026-09-0' . $day;
                    $this->upsert('attendance_records', $this->id("attendance-$tenantKey-$index-$day"), [
                        'tenant_id' => $tenantId, 'company_id' => $companyId, 'employee_id' => $employeeId, 'attendance_policy_id' => $policyId,
                        'attendance_date' => $date, 'clocked_in_at' => $date . ' 08:0' . $index . ':00+00', 'clocked_out_at' => $date . ' 17:00:00+00',
                        'regular_hours' => $index === 2 && $day === 2 ? '7.00' : '8.00', 'overtime_hours' => $day === 3 ? '1.50' : '0.00',
                        'status' => $index === 2 && $day === 2 ? 'partial' : 'present', 'metadata' => json_encode(['seeded' => true]),
                        'created_at' => $now, 'updated_at' => $now,
                    ]);
                }
                $this->upsert('timesheets', $this->id("timesheet-$tenantKey-" . ($index + 1)), [
                    'tenant_id' => $tenantId, 'company_id' => $companyId, 'employee_id' => $employeeId, 'approved_by' => $this->users[$tenantKey . '-payroll'],
                    'period_start' => '2026-09-01', 'period_end' => '2026-09-30', 'regular_hours' => '160.00', 'overtime_hours' => '4.00',
                    'status' => $index < 5 ? 'approved' : 'draft', 'approved_at' => $index < 5 ? '2026-09-30 12:00:00+00' : null,
                    'summary' => json_encode(['seeded' => true]), 'created_at' => $now, 'updated_at' => $now,
                ]);
            }

            $loanId = $this->id("loan-$tenantKey-1");
            $this->upsert('loans', $loanId, [
                'tenant_id' => $tenantId, 'company_id' => $companyId, 'employee_id' => $this->employees[$tenantKey][0],
                'loan_product_id' => $loanProductId, 'approved_by' => $this->users[$tenantKey . '-admin'], 'principal_amount' => '120000.00',
                'interest_amount' => '9600.00', 'total_amount' => '129600.00', 'outstanding_amount' => '86400.00', 'term_months' => 12,
                'start_date' => '2026-01-01', 'end_date' => '2026-12-31', 'status' => 'active', 'approved_at' => '2025-12-20 09:00:00+00',
                'approval_notes' => 'Development loan scenario', 'created_at' => $now, 'updated_at' => $now,
            ]);
            foreach ([['number' => 1, 'due' => '2026-01-25', 'paid' => '10800.00', 'status' => 'paid'], ['number' => 2, 'due' => '2026-02-25', 'paid' => '10800.00', 'status' => 'paid'], ['number' => 3, 'due' => '2026-03-25', 'paid' => '0.00', 'status' => 'scheduled']] as $repayment) {
                $this->upsert('loan_repayments', $this->id("repayment-$tenantKey-" . $repayment['number']), [
                    'tenant_id' => $tenantId, 'loan_id' => $loanId, 'payroll_entry_id' => null, 'installment_number' => $repayment['number'],
                    'due_date' => $repayment['due'], 'principal_amount' => '10000.00', 'interest_amount' => '800.00', 'total_amount' => '10800.00',
                    'paid_amount' => $repayment['paid'], 'status' => $repayment['status'], 'paid_at' => $repayment['status'] === 'paid' ? $repayment['due'] . ' 12:00:00+00' : null,
                    'created_at' => $now, 'updated_at' => $now,
                ]);
            }
            $this->upsert('public_holidays', $this->id("holiday-$tenantKey-2026-labour"), [
                'tenant_id' => $tenantId, 'company_id' => $companyId, 'country' => $tenantKey === 'kenya' ? 'KE' : 'UG',
                'name' => 'Labour Day', 'holiday_date' => '2026-05-01', 'is_paid' => true, 'created_at' => $now, 'updated_at' => $now,
            ]);
        }
    }

    private function seedDocuments(): void
    {
        $now = now();
        foreach ($this->tenants as $tenantKey => $tenantId) {
            $this->setTenant($tenantId);
            $typeId = $this->id("document-type-$tenantKey-id");
            $this->upsert('document_types', $typeId, [
                'tenant_id' => $tenantId, 'company_id' => $this->companies[$tenantKey], 'name' => 'National ID (development)',
                'code' => 'NATIONAL-ID', 'required' => true, 'active' => true, 'created_at' => $now, 'updated_at' => $now,
            ]);
            $documentId = $this->id("employee-document-$tenantKey-1");
            $this->upsert('employee_documents', $documentId, [
                'tenant_id' => $tenantId, 'company_id' => $this->companies[$tenantKey], 'employee_id' => $this->employees[$tenantKey][0],
                'document_type_id' => $typeId, 'uploaded_by' => $this->users[$tenantKey . '-hr'], 'title' => 'Development identity document',
                'status' => 'active', 'expires_on' => '2030-12-31', 'created_at' => $now, 'updated_at' => $now,
            ]);
            $this->upsert('document_versions', $this->id("document-version-$tenantKey-1"), [
                'tenant_id' => $tenantId, 'employee_document_id' => $documentId, 'uploaded_by' => $this->users[$tenantKey . '-hr'],
                'version' => 1, 'disk' => 'local', 'path' => 'seed/documents/' . $documentId . '.pdf',
                'original_filename' => 'development-national-id.pdf', 'mime_type' => 'application/pdf', 'size' => 1024,
                'checksum' => hash('sha256', 'development-document-' . $tenantKey), 'uploaded_at' => '2026-01-10 10:00:00+00',
                'created_at' => $now, 'updated_at' => $now,
            ]);
        }
    }

    private function seedBillingAndPayments(): void
    {
        $now = now();
        foreach ($this->tenants as $tenantKey => $tenantId) {
            $this->setTenant($tenantId);
            $currency = $tenantKey === 'kenya' ? 'KES' : 'UGX';
            $subscriptionId = $this->id('subscription-' . $tenantKey);
            $invoiceId = $this->id("invoice-$tenantKey-2026-09");
            $this->upsert('invoices', $invoiceId, [
                'tenant_id' => $tenantId, 'subscription_id' => $subscriptionId, 'invoice_number' => 'INV-' . strtoupper($tenantKey) . '-2026-09',
                'status' => 'paid', 'billing_period_start' => '2026-09-01', 'billing_period_end' => '2026-09-30',
                'subtotal' => $tenantKey === 'kenya' ? '8500.00' : '2500.00', 'tax' => '0.00',
                'total' => $tenantKey === 'kenya' ? '8500.00' : '2500.00', 'currency' => $currency,
                'issued_at' => '2026-09-01 08:00:00+00', 'due_at' => '2026-09-07 08:00:00+00', 'paid_at' => '2026-09-02 08:00:00+00',
                'provider' => 'development', 'provider_invoice_id' => 'dev-invoice-' . $tenantKey, 'line_items' => json_encode(['plan' => 'development']),
                'created_at' => $now, 'updated_at' => $now,
            ]);
            $this->upsert('usage_records', $this->id("usage-$tenantKey-2026-09"), [
                'tenant_id' => $tenantId, 'subscription_id' => $subscriptionId, 'metric' => 'employees',
                'quantity' => 10, 'unit' => 'employee', 'period_start' => '2026-09-01', 'period_end' => '2026-09-30',
                'metadata' => json_encode(['seeded' => true]), 'created_at' => $now, 'updated_at' => $now,
            ]);
            $this->upsert('payment_transactions', $this->id("payment-$tenantKey-2026-09"), [
                'tenant_id' => $tenantId, 'invoice_id' => $invoiceId, 'provider' => 'development',
                'provider_transaction_id' => 'dev-payment-' . $tenantKey, 'idempotency_key' => 'seed-payment-' . $tenantKey,
                'status' => 'succeeded', 'amount' => $tenantKey === 'kenya' ? '8500.00' : '2500.00', 'currency' => $currency,
                'completed_at' => '2026-09-02 08:00:00+00', 'provider_response' => json_encode(['environment' => 'development']),
                'created_at' => $now, 'updated_at' => $now,
            ]);
            $this->upsert('payment_provider_events', $this->id("payment-event-$tenantKey-2026-09"), [
                'tenant_id' => $tenantId, 'provider' => 'development', 'provider_event_id' => 'dev-event-' . $tenantKey,
                'event_type' => 'payment.succeeded', 'payload' => json_encode(['development' => true]), 'status' => 'processed',
                'processed_at' => '2026-09-02 08:01:00+00', 'created_at' => $now, 'updated_at' => $now,
            ]);
        }
    }

    private function seedNotificationsWebhooksAndApiKeys(): void
    {
        $now = now();
        foreach ($this->tenants as $tenantKey => $tenantId) {
            $this->setTenant($tenantId);
            $templateId = $this->id("notification-template-$tenantKey-payroll");
            $this->upsert('notification_templates', $templateId, [
                'tenant_id' => $tenantId, 'code' => 'PAYROLL_COMPLETED', 'channel' => 'in_app',
                'subject' => 'Payroll completed', 'body' => 'Your development payroll run is complete.', 'variables' => json_encode(['period' => 'string']),
                'active' => true, 'created_at' => $now, 'updated_at' => $now,
            ]);
            $notificationId = $this->id("notification-$tenantKey-payroll");
            $this->upsert('notifications', $notificationId, [
                'tenant_id' => $tenantId, 'user_id' => $this->users[$tenantKey . '-payroll'], 'template_id' => $templateId,
                'event_type' => 'payroll.completed', 'title' => 'Payroll completed', 'body' => 'The August development payroll is complete.',
                'data' => json_encode(['seeded' => true]), 'created_at' => $now, 'updated_at' => $now,
            ]);
            $this->upsert('notification_preferences', $this->id("preference-$tenantKey-payroll"), [
                'tenant_id' => $tenantId, 'user_id' => $this->users[$tenantKey . '-payroll'], 'event_type' => 'payroll.completed',
                'in_app' => true, 'email' => true, 'sms' => false, 'push' => false,
                'created_at' => $now, 'updated_at' => $now,
            ]);
            $this->upsert('notification_deliveries', $this->id("delivery-$tenantKey-in_app"), [
                'tenant_id' => $tenantId, 'notification_id' => $notificationId, 'channel' => 'in_app',
                'status' => 'sent', 'attempts' => 1, 'sent_at' => '2026-08-25 12:00:00+00', 'created_at' => $now, 'updated_at' => $now,
            ]);
            $webhookId = $this->id("webhook-$tenantKey");
            $this->upsert('webhook_endpoints', $webhookId, [
                'tenant_id' => $tenantId, 'name' => 'Development webhook', 'url' => 'https://example.test/webhooks/payroll',
                'secret_hash' => hash('sha256', 'development-webhook-secret-' . $tenantKey), 'events' => json_encode(['payroll.completed']),
                'status' => 'active', 'created_at' => $now, 'updated_at' => $now,
            ]);
            $this->upsert('webhook_delivery_logs', $this->id("webhook-log-$tenantKey"), [
                'tenant_id' => $tenantId, 'webhook_endpoint_id' => $webhookId, 'event_type' => 'payroll.completed',
                'event_id' => 'seed-event-' . $tenantKey, 'status' => 'delivered', 'attempts' => 1, 'response_status' => 200,
                'response_time_ms' => 12, 'response_body' => '{"development":true}', 'delivered_at' => '2026-08-25 12:01:00+00',
                'created_at' => $now, 'updated_at' => $now,
            ]);
            $apiKeyId = $this->id("api-key-$tenantKey");
            $this->upsert('api_keys', $apiKeyId, [
                'tenant_id' => $tenantId, 'created_by' => $this->users[$tenantKey . '-admin'], 'name' => 'Development integration key',
                'prefix' => 'dev_' . substr($tenantKey, 0, 3), 'secret_hash' => hash('sha256', 'development-api-key-' . $tenantKey),
                'status' => 'active', 'created_at' => $now, 'updated_at' => $now,
            ]);
            $this->upsert('api_key_permissions', $this->id("api-key-permission-$tenantKey"), [
                'tenant_id' => $tenantId, 'api_key_id' => $apiKeyId, 'permission' => 'payroll.view', 'created_at' => $now, 'updated_at' => $now,
            ]);
            $this->upsert('api_key_usage', $this->id("api-key-usage-$tenantKey"), [
                'tenant_id' => $tenantId, 'api_key_id' => $apiKeyId, 'endpoint' => '/api/v1/payroll/runs',
                'method' => 'GET', 'response_status' => 200, 'response_time_ms' => 18, 'used_at' => '2026-09-01 10:00:00+00',
                'created_at' => $now, 'updated_at' => $now,
            ]);
        }
    }

    private function seedAccountingAndOperations(): void
    {
        $now = now();
        foreach ($this->tenants as $tenantKey => $tenantId) {
            $this->setTenant($tenantId);
            $companyId = $this->companies[$tenantKey];
            $connectionId = $this->id("accounting-$tenantKey");
            $this->upsert('accounting_connections', $connectionId, [
                'tenant_id' => $tenantId, 'company_id' => $companyId, 'provider' => 'xero', 'status' => 'connected',
                'access_token_encrypted' => hash('sha256', 'development-access-token'), 'refresh_token_encrypted' => hash('sha256', 'development-refresh-token'),
                'token_expires_at' => '2026-12-31 00:00:00+00', 'external_account_id' => 'dev-xero-' . $tenantKey,
                'metadata' => json_encode(['environment' => 'development']), 'created_at' => $now, 'updated_at' => $now,
            ]);
            $this->upsert('accounting_mappings', $this->id("accounting-map-$tenantKey"), [
                'tenant_id' => $tenantId, 'accounting_connection_id' => $connectionId, 'entity_type' => 'salary_component',
                'local_code' => 'BASIC', 'external_code' => '4000', 'metadata' => json_encode([]), 'created_at' => $now, 'updated_at' => $now,
            ]);
            $jobId = $this->id("accounting-job-$tenantKey");
            $this->upsert('accounting_sync_jobs', $jobId, [
                'tenant_id' => $tenantId, 'accounting_connection_id' => $connectionId, 'entity_type' => 'payroll',
                'status' => 'completed', 'started_at' => '2026-09-01 11:00:00+00', 'completed_at' => '2026-09-01 11:01:00+00',
                'filters' => json_encode(['period' => '2026-08']), 'created_at' => $now, 'updated_at' => $now,
            ]);
            $this->upsert('accounting_sync_records', $this->id("accounting-record-$tenantKey"), [
                'tenant_id' => $tenantId, 'accounting_sync_job_id' => $jobId, 'entity_type' => 'payroll',
                'local_id' => $this->payrollPeriods[$tenantKey]['previous'], 'external_id' => 'dev-external-payroll-' . $tenantKey,
                'status' => 'synced', 'response' => json_encode(['development' => true]), 'created_at' => $now, 'updated_at' => $now,
            ]);
            $this->upsert('invitations', $this->id("invitation-$tenantKey"), [
                'tenant_id' => $tenantId, 'company_id' => $companyId, 'invited_by' => $this->users[$tenantKey . '-admin'],
                'email' => 'new.user@' . $tenantKey . '.payrollfiti.test', 'token_hash' => hash('sha256', 'development-invitation-' . $tenantKey),
                'status' => 'pending', 'expires_at' => '2026-12-31 00:00:00+00', 'created_at' => $now, 'updated_at' => $now,
            ]);
            $this->upsert('idempotency_keys', $this->id("idempotency-$tenantKey"), [
                'tenant_id' => $tenantId, 'user_id' => $this->users[$tenantKey . '-payroll'], 'key' => 'seed-payroll-' . $tenantKey,
                'request_hash' => hash('sha256', 'seed-request-' . $tenantKey), 'response_status' => 200,
                'response_headers' => json_encode(['content-type' => 'application/json']), 'response_body' => json_encode(['seeded' => true]),
                'completed_at' => '2026-08-25 12:00:00+00', 'created_at' => $now, 'updated_at' => $now,
            ]);
            $this->upsert('outbox_events', $this->id("outbox-$tenantKey"), [
                'tenant_id' => $tenantId, 'event_type' => 'payroll.completed', 'aggregate_type' => 'payroll_run',
                'aggregate_id' => $this->id("run-$tenantKey-previous"), 'payload' => json_encode(['seeded' => true]),
                'available_at' => '2026-08-25 12:00:00+00', 'dispatched_at' => '2026-08-25 12:01:00+00', 'attempts' => 1,
                'created_at' => $now, 'updated_at' => $now,
            ]);
            $this->upsert('audit_logs', $this->id("audit-$tenantKey"), [
                'tenant_id' => $tenantId, 'user_id' => $this->users[$tenantKey . '-admin'], 'action' => 'seed.demo_data_created',
                'auditable_type' => 'Tenant', 'auditable_id' => $tenantId, 'old_values' => json_encode([]),
                'new_values' => json_encode(['development' => true]), 'ip_address' => '127.0.0.1',
                'user_agent' => 'PayrollFiti development seeder', 'correlation_id' => 'seed-' . $tenantKey, 'created_at' => $now,
            ]);
            foreach ([['table' => 'report_jobs', 'type' => 'payroll_summary', 'format' => null], ['table' => 'export_jobs', 'type' => 'employee_export', 'format' => 'csv']] as $job) {
                $data = [
                    'tenant_id' => $tenantId, 'requested_by' => $this->users[$tenantKey . '-admin'],
                    $job['table'] === 'report_jobs' ? 'report_type' : 'export_type' => $job['type'],
                    'status' => 'completed', 'filters' => json_encode(['seeded' => true]), 'disk' => 'local',
                    'path' => 'seed/exports/' . $tenantKey . '-' . $job['type'] . ($job['format'] ? '.csv' : '.pdf'),
                    'completed_at' => '2026-08-25 12:00:00+00', 'expires_at' => '2027-08-25 12:00:00+00',
                    'created_at' => $now, 'updated_at' => $now,
                ];
                if ($job['table'] === 'export_jobs') {
                    $data['format'] = $job['format'];
                }
                $this->upsert($job['table'], $this->id($job['table'] . '-' . $tenantKey), $data);
            }
        }
    }

    private function upsert(string $table, string $id, array $values): void
    {
        DB::table($table)->updateOrInsert(['id' => $id], $values + ['id' => $id]);
    }

    private function setTenant(string $tenantId): void
    {
        DB::statement("SELECT set_config('app.current_tenant_id', ?, false)", [$tenantId]);
    }

    private function id(string $key): string
    {
        $hash = hash('sha256', 'payrollfiti-seed:' . $key);
        return sprintf('%s-%s-%s-%s-%s', substr($hash, 0, 8), substr($hash, 8, 4), '5' . substr($hash, 13, 3), dechex(8 + (hexdec(substr($hash, 16, 2)) % 4)) . substr($hash, 18, 3), substr($hash, 21, 12));
    }
}
