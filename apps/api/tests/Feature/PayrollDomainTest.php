<?php

namespace Tests\Feature;

use App\Domain\Payroll\Engine\Money;
use App\Models\Company;
use App\Models\Employee;
use App\Models\Permission;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class PayrollDomainTest extends TestCase
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
            ['name' => 'employees.manage'],
            ['slug' => 'employees.manage', 'domain' => 'employees', 'guard_name' => 'web'],
        );
        Permission::updateOrCreate(
            ['name' => 'payroll.manage'],
            ['slug' => 'payroll.manage', 'domain' => 'payroll', 'guard_name' => 'web'],
        );

        $this->user->givePermissionTo('employees.manage');
        $this->user->givePermissionTo('payroll.manage');
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

        // Now recreate the minimal schema
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
    }

    public function test_employees_are_created_and_scoped_to_the_current_tenant(): void
    {
        $response = $this->postJson('/api/v1/employees', [
            'company_id' => $this->company->id,
            'employee_number' => 'EMP-1001',
            'first_name' => 'Jane',
            'last_name' => 'Njeri',
            'country' => 'KE',
            'hire_date' => '2024-01-03',
            'status' => 'active',
        ]);

        $response->assertCreated();
        $response->assertJsonPath('data.employee_number', 'EMP-1001');
        $this->assertDatabaseHas('employees', [
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'employee_number' => 'EMP-1001',
        ]);
    }

    public function test_cross_tenant_employee_reads_are_forbidden(): void
    {
        $otherTenant = Tenant::create([
            'name' => 'Beta Ltd',
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
            'employee_number' => 'EMP-9001',
            'first_name' => 'Victor',
            'last_name' => 'Kola',
            'country' => 'NG',
            'hire_date' => '2024-01-03',
            'status' => 'active',
        ]);

        $response = $this->getJson('/api/v1/employees/'.$otherEmployee->id);

        $response->assertForbidden();
    }

    public function test_payroll_runs_can_be_created_with_tenant_scoped_employee_entries_and_deduplicated(): void
    {
        $employee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'employee_number' => 'EMP-1002',
            'first_name' => 'Peter',
            'last_name' => 'Kibaki',
            'country' => 'KE',
            'hire_date' => '2024-01-05',
            'status' => 'active',
        ]);

        $payload = [
            'company_id' => $this->company->id,
            'period_start' => '2024-01-01',
            'period_end' => '2024-01-31',
            'pay_date' => '2024-02-02',
            'employee_entries' => [[
                'employee_id' => $employee->id,
                'basic_salary' => 50000,
                'allowances' => ['housing' => 5000],
                'voluntary_deductions' => ['sacco' => 2500],
            ]],
        ];

        $first = $this->postJson('/api/v1/payroll/runs', $payload);
        $first->assertCreated();
        $this->assertDatabaseHas('payroll_runs', ['company_id' => $this->company->id, 'tenant_id' => $this->tenant->id]);

        $second = $this->postJson('/api/v1/payroll/runs', $payload);
        $second->assertCreated();
        $this->assertSame($first->json('data.input_hash'), $second->json('data.input_hash'));
    }

    public function test_payroll_entries_persist_taxable_income_and_employer_contributions_from_the_calculation_result(): void
    {
        $employee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'employee_number' => 'EMP-1003',
            'first_name' => 'Aisha',
            'last_name' => 'Wanjiku',
            'country' => 'KE',
            'hire_date' => '2024-01-08',
            'status' => 'active',
        ]);

        $response = $this->postJson('/api/v1/payroll/runs', [
            'company_id' => $this->company->id,
            'period_start' => '2024-01-01',
            'period_end' => '2024-01-31',
            'pay_date' => '2024-02-02',
            'employee_entries' => [[
                'employee_id' => $employee->id,
                'basic_salary' => 50000,
                'allowances' => ['housing' => 5000],
                'voluntary_deductions' => ['sacco' => 2500],
            ]],
        ]);

        $response->assertCreated();

        $entry = $employee->payrollEntries()->firstOrFail();

        $breakdown = is_array($entry->breakdown) ? $entry->breakdown : json_decode($entry->breakdown, true);
        $totalEmployeeStatutory = Money::sum(
            array_map(fn ($line) => (string) $line['employeeAmount'], $breakdown['statutoryDeductions'] ?? [])
        );

        $this->assertSame(
            Money::round2(Money::sub((string) $entry->gross_pay, $totalEmployeeStatutory)),
            (string) $entry->taxable_pay,
        );
        $this->assertSame('0', (string) $entry->employer_contributions);
    }
}
