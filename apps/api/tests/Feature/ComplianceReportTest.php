<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\ComplianceReport;
use App\Models\Employee;
use App\Models\PayrollEntry;
use App\Models\PayrollRun;
use App\Models\Permission;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class ComplianceReportTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->createMinimalSchema();

        $this->tenant = Tenant::create([
            'name' => 'Acme Holdings',
            'slug' => (string) Str::uuid(),
            'subdomain' => (string) Str::uuid(),
            'default_country' => 'KE',
            'default_currency' => 'KES',
        ]);

        $this->company = Company::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Acme Payroll',
            'country' => 'KE',
            'currency' => 'KES',
            'legal_name' => 'Acme Payroll Limited',
            'registration_number' => 'RC-1000',
            'email' => 'ops-'.Str::uuid().'@test',
            'status' => 'active',
        ]);

        $this->user = User::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Payroll Admin',
            'email' => 'admin@'.Str::uuid().'.test',
            'password' => bcrypt('password'),
            'email_verified_at' => now(),
        ]);

        Permission::updateOrCreate(
            ['name' => 'payroll.view'],
            ['slug' => 'payroll.view', 'domain' => 'payroll', 'guard_name' => 'web'],
        );
        Permission::updateOrCreate(
            ['name' => 'payroll.manage'],
            ['slug' => 'payroll.manage', 'domain' => 'payroll', 'guard_name' => 'web'],
        );
        Permission::updateOrCreate(
            ['name' => 'compliance.view'],
            ['slug' => 'compliance.view', 'domain' => 'compliance', 'guard_name' => 'web'],
        );
        Permission::updateOrCreate(
            ['name' => 'compliance.generate'],
            ['slug' => 'compliance.generate', 'domain' => 'compliance', 'guard_name' => 'web'],
        );

        $this->user->givePermissionTo('payroll.view');
        $this->user->givePermissionTo('payroll.manage');
        $this->user->givePermissionTo('compliance.view');
        $this->user->givePermissionTo('compliance.generate');

        $this->actingAs($this->user, 'sanctum');
    }

    protected function createMinimalSchema(): void
    {
        $tables = [
            'payslips',
            'loan_repayments',
            'payroll_entry_items',
            'payroll_entries',
            'payroll_runs',
            'employees',
            'companies',
            'tenants',
            'users',
            'model_has_permissions',
            'model_has_roles',
            'role_has_permissions',
            'user_roles',
            'role_permissions',
            'permissions',
            'roles',
            'personal_access_tokens',
            'compliance_reports',
        ];

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('DROP TABLE IF EXISTS ' . implode(', ', $tables) . ' CASCADE');
        } else {
            DB::statement('PRAGMA foreign_keys = OFF');
            foreach ($tables as $table) {
                DB::statement('DROP TABLE IF EXISTS ' . $table);
            }
            DB::statement('PRAGMA foreign_keys = ON');
        }

        Schema::create('tenants', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('subdomain')->unique();
            $table->string('default_country', 2)->default('KE');
            $table->string('default_currency', 3)->default('KES');
            $table->json('branding')->nullable();
            $table->string('status')->default('active');
            $table->timestamp('trial_ends_at')->nullable();
            $table->timestamps();
        });

        Schema::create('companies', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->string('name');
            $table->string('legal_name')->nullable();
            $table->string('registration_number')->nullable();
            $table->string('tax_number')->nullable();
            $table->string('country', 2)->default('KE');
            $table->string('currency', 3)->default('KES');
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->json('address')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->nullable();
            $table->string('name');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->rememberToken();
            $table->timestamps();
        });

        Schema::create('employees', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('company_id');
            $table->uuid('department_id')->nullable();
            $table->uuid('position_id')->nullable();
            $table->uuid('work_location_id')->nullable();
            $table->uuid('salary_structure_id')->nullable();
            $table->string('employee_number');
            $table->string('first_name');
            $table->string('middle_name')->nullable();
            $table->string('last_name');
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->string('country', 2);
            $table->date('hire_date');
            $table->date('termination_date')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('payroll_runs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('company_id');
            $table->uuid('payroll_period_id')->nullable();
            $table->date('period_start');
            $table->date('period_end');
            $table->date('pay_date');
            $table->string('status')->default('draft');
            $table->char('input_hash', 64);
            $table->uuid('rule_set_id')->nullable();
            $table->string('rule_version');
            $table->uuid('initiated_by');
            $table->uuid('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->uuid('finalized_by')->nullable();
            $table->timestamp('finalized_at')->nullable();
            $table->uuid('corrects_run_id')->nullable();
            $table->json('input_snapshot')->nullable();
            $table->timestamps();
        });

        Schema::create('payroll_entries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('payroll_run_id');
            $table->uuid('employee_id');
            $table->decimal('gross_pay', 18, 2);
            $table->decimal('taxable_pay', 18, 2)->default(0);
            $table->decimal('total_deductions', 18, 2);
            $table->decimal('employer_contributions', 18, 2)->default(0);
            $table->decimal('net_pay', 18, 2);
            $table->json('breakdown');
            $table->timestamp('created_at');
        });

        Schema::create('personal_access_tokens', function (Blueprint $table) {
            $table->id();
            $table->morphs('tokenable');
            $table->string('name');
            $table->string('token', 64)->unique();
            $table->text('abilities')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });

        Schema::create('permissions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('guard_name')->default('web');
            $table->string('slug')->unique();
            $table->string('domain');
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('roles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->nullable();
            $table->string('name');
            $table->string('guard_name')->default('web');
            $table->string('slug')->unique();
            $table->timestamps();
        });

        Schema::create('model_has_permissions', function (Blueprint $table) {
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('model_type');
            $table->foreignUuid('permission_id')->constrained('permissions')->cascadeOnDelete();
            $table->primary(['user_id', 'model_type', 'permission_id']);
        });

        Schema::create('user_roles', function (Blueprint $table) {
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('role_id')->constrained('roles')->cascadeOnDelete();
            $table->primary(['user_id', 'role_id']);
        });

        Schema::create('role_permissions', function (Blueprint $table) {
            $table->uuid('permission_id');
            $table->uuid('role_id');
        });

        Schema::create('compliance_reports', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('company_id');
            $table->uuid('payroll_run_id');
            $table->string('country', 2);
            $table->string('report_code');
            $table->string('report_version');
            $table->string('status')->default('generated');
            $table->timestamp('generated_at')->useCurrent();
            $table->jsonb('rows')->default('[]');
            $table->jsonb('totals')->default('{}');
            $table->jsonb('metadata')->nullable();
            $table->timestamps();
        });
    }

    public function test_country_specific_report_is_generated_from_persisted_payroll_entries(): void
    {
        $employee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'employee_number' => 'EMP-1001',
            'first_name' => 'Jane',
            'last_name' => 'Njeri',
            'country' => 'KE',
            'hire_date' => '2024-01-03',
            'status' => 'active',
        ]);

        $payrollRun = PayrollRun::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'period_start' => '2024-01-01',
            'period_end' => '2024-01-31',
            'pay_date' => '2024-02-02',
            'status' => 'draft',
            'input_hash' => hash('sha256', 'ke-256'),
            'rule_version' => 'KE-2025.1',
            'initiated_by' => $this->user->id,
            'input_snapshot' => ['employee_ids' => [$employee->id]],
        ]);

        $entry = PayrollEntry::create([
            'tenant_id' => $this->tenant->id,
            'payroll_run_id' => $payrollRun->id,
            'employee_id' => $employee->id,
            'gross_pay' => 50000,
            'taxable_pay' => 42500,
            'total_deductions' => 7500,
            'employer_contributions' => 0,
            'net_pay' => 42500,
            'breakdown' => ['gross_pay' => 50000],
            'created_at' => now(),
        ]);

        $response = $this->postJson('/api/v1/compliance/reports', ['payroll_run_id' => $payrollRun->id]);

        $response->assertCreated();
        $response->assertJsonPath('data.country', 'KE');
        $response->assertJsonPath('data.report_code', 'KE-P9');
        $this->assertSame((float) $entry->gross_pay, (float) $response->json('data.totals.gross_pay'));
        $this->assertDatabaseHas('compliance_reports', [
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'payroll_run_id' => $payrollRun->id,
            'report_code' => 'KE-P9',
            'country' => 'KE',
        ]);
    }

    public function test_wrong_country_report_code_is_rejected(): void
    {
        $employee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'employee_number' => 'EMP-1002',
            'first_name' => 'Brian',
            'last_name' => 'Mwangi',
            'country' => 'KE',
            'hire_date' => '2024-01-10',
            'status' => 'active',
        ]);

        $payrollRun = PayrollRun::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'period_start' => '2024-02-01',
            'period_end' => '2024-02-29',
            'pay_date' => '2024-03-02',
            'status' => 'draft',
            'input_hash' => hash('sha256', 'ke-256-2'),
            'rule_version' => 'KE-2025.1',
            'initiated_by' => $this->user->id,
            'input_snapshot' => ['employee_ids' => [$employee->id]],
        ]);

        PayrollEntry::create([
            'tenant_id' => $this->tenant->id,
            'payroll_run_id' => $payrollRun->id,
            'employee_id' => $employee->id,
            'gross_pay' => 30000,
            'taxable_pay' => 25000,
            'total_deductions' => 5000,
            'employer_contributions' => 0,
            'net_pay' => 25000,
            'breakdown' => ['gross_pay' => 30000],
            'created_at' => now(),
        ]);

        $response = $this->postJson('/api/v1/compliance/reports', [
            'payroll_run_id' => $payrollRun->id,
            'report_code' => 'NG-PAYE',
        ]);

        $response->assertStatus(422);
    }

    public function test_cross_tenant_report_access_is_forbidden(): void
    {
        $otherTenant = Tenant::create([
            'name' => 'Beta West',
            'slug' => (string) Str::uuid(),
            'subdomain' => (string) Str::uuid(),
            'default_country' => 'NG',
            'default_currency' => 'NGN',
        ]);

        $otherCompany = Company::create([
            'tenant_id' => $otherTenant->id,
            'name' => 'Beta Payroll',
            'country' => 'NG',
            'currency' => 'NGN',
            'legal_name' => 'Beta Payroll Limited',
            'registration_number' => 'RC-9090',
            'email' => 'ops-'.Str::uuid().'@test',
            'status' => 'active',
        ]);

        $otherEmployee = Employee::create([
            'tenant_id' => $otherTenant->id,
            'company_id' => $otherCompany->id,
            'employee_number' => 'EMP-2001',
            'first_name' => 'Chinedu',
            'last_name' => 'Adebayo',
            'country' => 'NG',
            'hire_date' => '2024-01-05',
            'status' => 'active',
        ]);

        $otherRun = PayrollRun::create([
            'tenant_id' => $otherTenant->id,
            'company_id' => $otherCompany->id,
            'period_start' => '2024-01-01',
            'period_end' => '2024-01-31',
            'pay_date' => '2024-02-02',
            'status' => 'draft',
            'input_hash' => hash('sha256', 'ng-1'),
            'rule_version' => 'NG-2025.1',
            'initiated_by' => $this->user->id,
            'input_snapshot' => ['employee_ids' => [$otherEmployee->id]],
        ]);

        $otherReport = ComplianceReport::create([
            'tenant_id' => $otherTenant->id,
            'company_id' => $otherCompany->id,
            'payroll_run_id' => $otherRun->id,
            'country' => 'NG',
            'report_code' => 'NG-PAYE',
            'report_version' => 'NG-2025.1',
            'status' => 'generated',
            'rows' => [],
            'totals' => ['gross_pay' => 0],
            'metadata' => ['source' => 'persisted_payroll_entries'],
        ]);

        $response = $this->getJson('/api/v1/compliance/reports/'.$otherReport->id);

        $response->assertForbidden();
    }

    public function test_fourth_country_uganda_report_can_be_generated(): void
    {
        $ugandaCompany = Company::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Acme Uganda',
            'country' => 'UG',
            'currency' => 'UGX',
            'legal_name' => 'Acme Uganda Limited',
            'registration_number' => 'RC-UG-1001',
            'email' => 'ug-'.Str::uuid().'@test',
            'status' => 'active',
        ]);

        $ugandaEmployee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $ugandaCompany->id,
            'employee_number' => 'EMP-UG-001',
            'first_name' => 'Moses',
            'last_name' => 'Kabira',
            'country' => 'UG',
            'hire_date' => '2024-01-15',
            'status' => 'active',
        ]);

        $ugandaPayrollRun = PayrollRun::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $ugandaCompany->id,
            'period_start' => '2024-01-01',
            'period_end' => '2024-01-31',
            'pay_date' => '2024-02-02',
            'status' => 'draft',
            'input_hash' => hash('sha256', 'ug-256'),
            'rule_version' => 'UG-2025.1',
            'initiated_by' => $this->user->id,
            'input_snapshot' => ['employee_ids' => [$ugandaEmployee->id]],
        ]);

        PayrollEntry::create([
            'tenant_id' => $this->tenant->id,
            'payroll_run_id' => $ugandaPayrollRun->id,
            'employee_id' => $ugandaEmployee->id,
            'gross_pay' => 8000000,
            'taxable_pay' => 6500000,
            'total_deductions' => 1500000,
            'employer_contributions' => 0,
            'net_pay' => 6500000,
            'breakdown' => ['gross_pay' => 8000000],
            'created_at' => now(),
        ]);

        $response = $this->postJson('/api/v1/compliance/reports', ['payroll_run_id' => $ugandaPayrollRun->id]);

        $response->assertCreated();
        $response->assertJsonPath('data.country', 'UG');
        $response->assertJsonPath('data.report_code', 'UG-PAYE');
        $response->assertJsonPath('data.report_version', 'UG-2025.1');
        $this->assertDatabaseHas('compliance_reports', [
            'tenant_id' => $this->tenant->id,
            'company_id' => $ugandaCompany->id,
            'payroll_run_id' => $ugandaPayrollRun->id,
            'report_code' => 'UG-PAYE',
            'country' => 'UG',
        ]);
    }

    public function test_compliance_report_source_is_persisted_payroll_entries(): void
    {
        $employee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'employee_number' => 'EMP-1003',
            'first_name' => 'John',
            'last_name' => 'Doe',
            'country' => 'KE',
            'hire_date' => '2024-01-03',
            'status' => 'active',
        ]);

        $payrollRun = PayrollRun::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'period_start' => '2024-03-01',
            'period_end' => '2024-03-31',
            'pay_date' => '2024-04-02',
            'status' => 'draft',
            'input_hash' => hash('sha256', 'ke-source-test'),
            'rule_version' => 'KE-2025.1',
            'initiated_by' => $this->user->id,
            'input_snapshot' => ['employee_ids' => [$employee->id]],
        ]);

        $grossPay = 75000.00;
        $taxablePay = 60000.00;
        $totalDeductions = 15000.00;
        $netPay = 45000.00;

        PayrollEntry::create([
            'tenant_id' => $this->tenant->id,
            'payroll_run_id' => $payrollRun->id,
            'employee_id' => $employee->id,
            'gross_pay' => $grossPay,
            'taxable_pay' => $taxablePay,
            'total_deductions' => $totalDeductions,
            'employer_contributions' => 0,
            'net_pay' => $netPay,
            'breakdown' => ['gross_pay' => $grossPay],
            'created_at' => now(),
        ]);

        $response = $this->postJson('/api/v1/compliance/reports', ['payroll_run_id' => $payrollRun->id]);

        $response->assertCreated();
        $data = $response->json('data');

        // Verify the report consumes persisted payroll entries exactly
        $this->assertSame((float) $grossPay, (float) $data['totals']['gross_pay']);
        $this->assertSame((float) $taxablePay, (float) $data['totals']['taxable_pay']);
        $this->assertSame((float) $totalDeductions, (float) $data['totals']['total_deductions']);
        $this->assertSame((float) $netPay, (float) $data['totals']['net_pay']);

        // Verify metadata points to persisted source
        $this->assertSame('persisted_payroll_entries', $data['metadata']['source']);
        $this->assertSame($payrollRun->id, $data['metadata']['source_payroll_run_id']);
    }

    public function test_report_generation_is_idempotent(): void
    {
        $employee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'employee_number' => 'EMP-1004',
            'first_name' => 'Alice',
            'last_name' => 'Smith',
            'country' => 'KE',
            'hire_date' => '2024-01-03',
            'status' => 'active',
        ]);

        $payrollRun = PayrollRun::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'period_start' => '2024-04-01',
            'period_end' => '2024-04-30',
            'pay_date' => '2024-05-02',
            'status' => 'draft',
            'input_hash' => hash('sha256', 'ke-idempotent-test'),
            'rule_version' => 'KE-2025.1',
            'initiated_by' => $this->user->id,
            'input_snapshot' => ['employee_ids' => [$employee->id]],
        ]);

        PayrollEntry::create([
            'tenant_id' => $this->tenant->id,
            'payroll_run_id' => $payrollRun->id,
            'employee_id' => $employee->id,
            'gross_pay' => 90000,
            'taxable_pay' => 70000,
            'total_deductions' => 20000,
            'employer_contributions' => 0,
            'net_pay' => 70000,
            'breakdown' => ['gross_pay' => 90000],
            'created_at' => now(),
        ]);

        $first = $this->postJson('/api/v1/compliance/reports', ['payroll_run_id' => $payrollRun->id]);
        $second = $this->postJson('/api/v1/compliance/reports', ['payroll_run_id' => $payrollRun->id]);

        $first->assertCreated();
        $second->assertCreated();

        $firstData = $first->json('data');
        $secondData = $second->json('data');

        // Same financial values
        $this->assertSame($firstData['totals']['gross_pay'], $secondData['totals']['gross_pay']);
        $this->assertSame($firstData['totals']['net_pay'], $secondData['totals']['net_pay']);
        $this->assertSame($firstData['report_code'], $secondData['report_code']);
        $this->assertSame($firstData['report_version'], $secondData['report_version']);
    }
}
