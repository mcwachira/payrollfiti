<?php

declare(strict_types=1);

namespace Tests\Feature\Attendance;

use App\Models\AttendancePolicy;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class AttendanceTest extends TestCase
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

        foreach (['attendance.create', 'attendance.manage'] as $permission) {
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
        $this->user->givePermissionTo('attendance.create', 'attendance.manage');

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

    public function test_attendance_record_can_be_created(): void
    {
        $policy = AttendancePolicy::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'name' => 'Standard 8-5',
            'timezone' => 'Africa/Nairobi',
            'active' => true,
        ]);

        $response = $this->postJson('/api/v1/attendance/records/clock-in', [
            'employee_id' => $this->employee->id,
            'attendance_policy_id' => $policy->id,
            'company_id' => $this->company->id,
            'attendance_date' => '2026-09-12',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('attendance_records', [
            'tenant_id' => $this->tenant->id,
            'status' => 'present',
        ]);
    }

    public function test_attendance_record_can_be_marked_as_holiday(): void
    {
        $policy = AttendancePolicy::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'name' => 'Standard 8-5',
            'timezone' => 'Africa/Nairobi',
            'active' => true,
        ]);

        $response = $this->postJson('/api/v1/attendance/records/mark-holiday', [
            'employee_id' => $this->employee->id,
            'company_id' => $this->company->id,
            'attendance_date' => '2026-09-12',
            'attendance_policy_id' => $policy->id,
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('attendance_records', [
            'tenant_id' => $this->tenant->id,
            'status' => 'holiday',
        ]);
    }

    public function test_attendance_record_can_be_marked_as_absent(): void
    {
        $policy = AttendancePolicy::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'name' => 'Standard 8-5',
            'timezone' => 'Africa/Nairobi',
            'active' => true,
        ]);

        $response = $this->postJson('/api/v1/attendance/records/mark-absent', [
            'employee_id' => $this->employee->id,
            'company_id' => $this->company->id,
            'attendance_date' => '2026-09-12',
            'attendance_policy_id' => $policy->id,
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('attendance_records', [
            'tenant_id' => $this->tenant->id,
            'status' => 'absent',
        ]);
    }
}
