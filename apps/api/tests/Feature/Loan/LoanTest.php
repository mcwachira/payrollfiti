<?php

declare(strict_types=1);

namespace Tests\Feature\Loan;

use App\Models\Loan;
use App\Models\LoanProduct;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class LoanTest extends TestCase
{
    use RefreshDatabase;
    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::create([
            'id' => (string) Str::uuid(),
            'name' => 'Acme Holdings',
            'slug' => (string) Str::uuid(),
            'subdomain' => (string) Str::uuid(),
            'default_country' => 'KE',
            'default_currency' => 'KES',
        ]);

        $this->company = \App\Models\Company::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Acme Ltd',
            'country' => 'KE',
            'currency' => 'KES',
            'status' => 'active',
        ]);

        $this->user = User::create([
            'id' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'Payroll Admin',
            'email' => 'admin@'.Str::uuid().'.test',
            'password' => bcrypt('password'),
            'email_verified_at' => now(),
        ]);

        foreach (['loans.create', 'loans.manage'] as $permission) {
            if (! \Spatie\Permission\Models\Permission::where('name', $permission)->exists()) {
                $model = new \Spatie\Permission\Models\Permission([
                    'name' => $permission,
                    'slug' => $permission,
                    'domain' => explode('.', $permission)[0],
                    'guard_name' => 'web',
                ]);
                $model->id = (string) Str::uuid();
                $model->save();
            }
        }
        $this->user->givePermissionTo('loans.create', 'loans.manage');

        $this->employee = \App\Models\Employee::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => 'john@example.com',
            'phone' => '+254700000000',
            'employee_number' => 'EMP-001',
            'national_id' => '12345678',
            'kra_pin' => 'A123456789X',
            'nhif_number' => 'NHIF123456',
            'nssf_number' => 'NSSF123456',
            'country' => 'KE',
            'hire_date' => '2024-01-01',
            'employment_type' => 'permanent',
            'status' => 'active',
        ]);

        $this->actingAs($this->user, 'sanctum');
    }

    public function test_loan_can_be_created(): void
    {
        $product = LoanProduct::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'name' => 'Salary Advance',
            'code' => 'SALARY_ADV',
            'maximum_principal' => 100000,
            'annual_interest_rate' => 12.0,
            'maximum_term_months' => 12,
            'active' => true,
        ]);

        $response = $this->postJson('/api/v1/loans', [
            'employee_id' => $this->employee->id,
            'loan_product_id' => $product->id,
            'principal_amount' => 50000,
            'term_months' => 6,
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('loans', [
            'tenant_id' => $this->tenant->id,
            'status' => 'pending',
        ]);
    }

    public function test_loan_approval_generates_repayment_schedule(): void
    {
        $product = LoanProduct::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'name' => 'Salary Advance',
            'code' => 'SALARY_ADV',
            'maximum_principal' => 100000,
            'annual_interest_rate' => 12.0,
            'maximum_term_months' => 12,
            'active' => true,
        ]);

        $loan = Loan::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'employee_id' => $this->employee->id,
            'loan_product_id' => $product->id,
            'principal_amount' => 50000,
            'interest_amount' => 3000,
            'total_amount' => 53000,
            'outstanding_amount' => 53000,
            'term_months' => 6,
            'status' => 'pending',
        ]);

        $response = $this->postJson("/api/v1/loans/{$loan->id}/approve", [
            'notes' => 'Approved',
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('loans', [
            'id' => $loan->id,
            'status' => 'active',
        ]);
        $this->assertDatabaseCount('loan_repayments', 6);
    }

    public function test_loan_cannot_be_approved_twice(): void
    {
        $product = LoanProduct::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'name' => 'Salary Advance',
            'code' => 'SALARY_ADV',
            'maximum_principal' => 100000,
            'annual_interest_rate' => 12.0,
            'maximum_term_months' => 12,
            'active' => true,
        ]);

        $loan = Loan::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'employee_id' => $this->employee->id,
            'loan_product_id' => $product->id,
            'principal_amount' => 50000,
            'interest_amount' => 3000,
            'total_amount' => 53000,
            'outstanding_amount' => 53000,
            'term_months' => 6,
            'status' => 'active',
        ]);

        $response = $this->postJson("/api/v1/loans/{$loan->id}/approve");

        $response->assertStatus(422);
    }
}
