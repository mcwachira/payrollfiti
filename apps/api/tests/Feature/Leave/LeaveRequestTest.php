<?php

declare(strict_types=1);

namespace Tests\Feature\Leave;

use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class LeaveRequestTest extends TestCase
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

        foreach (['leave.create', 'leave.manage'] as $permission) {
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
        $this->user->givePermissionTo('leave.create', 'leave.manage');

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

    public function test_leave_request_can_be_created(): void
    {
        $leaveType = LeaveType::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'name' => 'Annual Leave',
            'code' => 'ANNUAL',
            'default_days_per_year' => 21,
            'accrual_type' => 'monthly',
            'is_paid' => true,
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/v1/leave/requests', [
            'leave_type_id' => $leaveType->id,
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-05',
            'days_requested' => 5,
            'reason' => 'Vacation',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('leave_requests', [
            'tenant_id' => $this->tenant->id,
            'status' => 'pending',
        ]);
    }

    public function test_leave_request_transition_to_approved(): void
    {
        $leaveType = LeaveType::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'name' => 'Annual Leave',
            'code' => 'ANNUAL',
            'default_days_per_year' => 21,
            'accrual_type' => 'monthly',
            'is_paid' => true,
            'is_active' => true,
        ]);

        $leaveRequest = LeaveRequest::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'employee_id' => $this->employee->id,
            'leave_type_id' => $leaveType->id,
            'submitted_by' => $this->user->id,
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-05',
            'days_requested' => 5,
            'reason' => 'Vacation',
            'status' => 'pending',
        ]);

        $response = $this->postJson("/api/v1/leave/requests/{$leaveRequest->id}/approve", [
            'comments' => 'Approved',
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('leave_requests', [
            'id' => $leaveRequest->id,
            'status' => 'approved',
        ]);
    }

    public function test_leave_request_transition_to_rejected(): void
    {
        $leaveType = LeaveType::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'name' => 'Annual Leave',
            'code' => 'ANNUAL',
            'default_days_per_year' => 21,
            'accrual_type' => 'monthly',
            'is_paid' => true,
            'is_active' => true,
        ]);

        $leaveRequest = LeaveRequest::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'employee_id' => $this->employee->id,
            'leave_type_id' => $leaveType->id,
            'submitted_by' => $this->user->id,
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-05',
            'days_requested' => 5,
            'reason' => 'Vacation',
            'status' => 'pending',
        ]);

        $response = $this->postJson("/api/v1/leave/requests/{$leaveRequest->id}/reject", [
            'comments' => 'Insufficient balance',
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('leave_requests', [
            'id' => $leaveRequest->id,
            'status' => 'rejected',
        ]);
    }

    public function test_leave_request_cannot_transition_illegally(): void
    {
        $leaveType = LeaveType::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'name' => 'Annual Leave',
            'code' => 'ANNUAL',
            'default_days_per_year' => 21,
            'accrual_type' => 'monthly',
            'is_paid' => true,
            'is_active' => true,
        ]);

        $leaveRequest = LeaveRequest::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'employee_id' => $this->employee->id,
            'leave_type_id' => $leaveType->id,
            'submitted_by' => $this->user->id,
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-05',
            'days_requested' => 5,
            'reason' => 'Vacation',
            'status' => 'approved',
        ]);

        $response = $this->postJson("/api/v1/leave/requests/{$leaveRequest->id}/approve");

        $response->assertStatus(422);
    }
}
