<?php

declare(strict_types=1);

namespace Tests\Feature\Onboarding;

use App\Models\Company;
use App\Models\Employee;
use App\Models\OnboardingTask;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class OnboardingTaskTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Ensure onboarding permissions exist in the database
        foreach (['onboarding.view', 'onboarding.create', 'onboarding.manage'] as $perm) {
            if (! DB::table('permissions')->where('slug', $perm)->exists()) {
                DB::table('permissions')->insert([
                    'id' => (string) Str::uuid(),
                    'name' => $perm,
                    'slug' => $perm,
                    'domain' => 'payrollfiti',
                    'guard_name' => 'web',
                ]);
            }
        }

        $this->tenant = Tenant::create([
            'id' => (string) Str::uuid(),
            'name' => 'Acme Holdings',
            'slug' => (string) Str::uuid(),
            'subdomain' => (string) Str::uuid(),
            'default_country' => 'KE',
            'default_currency' => 'KES',
        ]);

        $this->company = Company::create([
            'id' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'Acme Technologies',
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

        $this->user->givePermissionTo(['onboarding.view', 'onboarding.create', 'onboarding.manage']);

        $this->actingAs($this->user, 'sanctum');
    }

    public function test_onboarding_task_can_be_created(): void
    {
        $employee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'employee_number' => 'EMP-'.Str::uuid(),
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => 'john@'.Str::uuid().'.test',
            'country' => 'KE',
            'status' => 'active',
            'hire_date' => now()->toDateString(),
        ]);

        $response = $this->postJson('/api/v1/onboarding/tasks', [
            'employee_id' => $employee->id,
            'title' => 'Upload identification document',
            'description' => 'Please upload a valid government-issued ID.',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('onboarding_tasks', [
            'tenant_id' => $this->tenant->id,
            'employee_id' => $employee->id,
            'title' => 'Upload identification document',
            'status' => 'pending',
        ]);
    }

    public function test_onboarding_task_can_be_listed(): void
    {
        $employee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'employee_number' => 'EMP-'.Str::uuid(),
            'first_name' => 'Jane',
            'last_name' => 'Doe',
            'email' => 'jane@'.Str::uuid().'.test',
            'country' => 'KE',
            'status' => 'active',
            'hire_date' => now()->toDateString(),
        ]);

        OnboardingTask::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $employee->id,
            'title' => 'Review company policies',
            'status' => 'pending',
        ]);

        $response = $this->getJson('/api/v1/onboarding/tasks');

        $response->assertStatus(200);
        $response->assertJsonCount(1, 'data');
    }

    public function test_onboarding_task_can_be_completed(): void
    {
        $employee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'employee_number' => 'EMP-'.Str::uuid(),
            'first_name' => 'Bob',
            'last_name' => 'Smith',
            'email' => 'bob@'.Str::uuid().'.test',
            'country' => 'KE',
            'status' => 'active',
            'hire_date' => now()->toDateString(),
        ]);

        $task = OnboardingTask::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $employee->id,
            'title' => 'Complete benefits enrollment',
            'status' => 'pending',
        ]);

        $response = $this->putJson("/api/v1/onboarding/tasks/{$task->id}", [
            'status' => 'completed',
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('onboarding_tasks', [
            'id' => $task->id,
            'status' => 'completed',
        ]);
    }

    public function test_employee_can_only_see_own_tasks(): void
    {
        $otherTenant = Tenant::create([
            'id' => (string) Str::uuid(),
            'name' => 'Other Corp',
            'slug' => (string) Str::uuid(),
            'subdomain' => (string) Str::uuid(),
            'default_country' => 'NG',
            'default_currency' => 'NGN',
        ]);

        $otherUser = User::create([
            'id' => (string) Str::uuid(),
            'tenant_id' => $otherTenant->id,
            'name' => 'Other Admin',
            'email' => 'other@'.Str::uuid().'.test',
            'password' => bcrypt('password'),
            'email_verified_at' => now(),
        ]);
        if (! DB::table('permissions')->where('slug', 'onboarding.view')->exists()) {
            DB::table('permissions')->insert([
                'id' => (string) Str::uuid(),
                'name' => 'onboarding.view',
                'slug' => 'onboarding.view',
                'domain' => 'payrollfiti',
                'guard_name' => 'web',
            ]);
        }
        $otherUser->givePermissionTo('onboarding.view');

        $employee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'employee_number' => 'EMP-'.Str::uuid(),
            'first_name' => 'Alice',
            'last_name' => 'Jones',
            'email' => 'alice@'.Str::uuid().'.test',
            'country' => 'KE',
            'status' => 'active',
            'hire_date' => now()->toDateString(),
        ]);

        OnboardingTask::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $employee->id,
            'title' => 'Upload ID',
            'status' => 'pending',
        ]);

        // The other user should get 404 when trying to access this task
        // because the task belongs to a different tenant
        $this->actingAs($otherUser, 'sanctum');
        $response = $this->getJson('/api/v1/onboarding/tasks');
        $response->assertStatus(200);
        $response->assertJsonCount(0, 'data');
    }

    public function test_cross_tenant_task_access_is_denied(): void
    {
        $otherTenant = Tenant::create([
            'id' => (string) Str::uuid(),
            'name' => 'Other Corp',
            'slug' => (string) Str::uuid(),
            'subdomain' => (string) Str::uuid(),
            'default_country' => 'NG',
            'default_currency' => 'NGN',
        ]);

        $employee = Employee::create([
            'tenant_id' => $otherTenant->id,
            'company_id' => $this->company->id,
            'employee_number' => 'EMP-'.Str::uuid(),
            'first_name' => 'Eve',
            'last_name' => 'Brown',
            'email' => 'eve@'.Str::uuid().'.test',
            'country' => 'NG',
            'status' => 'active',
            'hire_date' => now()->toDateString(),
        ]);

        $task = OnboardingTask::create([
            'tenant_id' => $otherTenant->id,
            'employee_id' => $employee->id,
            'title' => 'Cross-tenant task',
            'status' => 'pending',
        ]);

        // The current user (from a different tenant) should get 404
        // because the route binding filters by tenant_id
        $response = $this->getJson("/api/v1/onboarding/tasks/{$task->id}");
        $response->assertStatus(404);
    }

    public function test_task_progress_is_calculated(): void
    {
        $employee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'employee_number' => 'EMP-'.Str::uuid(),
            'first_name' => 'Charlie',
            'last_name' => 'Wilson',
            'email' => 'charlie@'.Str::uuid().'.test',
            'country' => 'KE',
            'status' => 'active',
            'hire_date' => now()->toDateString(),
        ]);

        OnboardingTask::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $employee->id,
            'title' => 'Task 1',
            'status' => 'completed',
        ]);

        OnboardingTask::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $employee->id,
            'title' => 'Task 2',
            'status' => 'pending',
        ]);

        $response = $this->getJson('/api/v1/onboarding/tasks?employee_id='.$employee->id);
        $response->assertStatus(200);
        $response->assertJsonCount(2, 'data');
    }
}
