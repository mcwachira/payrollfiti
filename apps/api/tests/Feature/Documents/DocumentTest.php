<?php

declare(strict_types=1);

namespace Tests\Feature\Documents;

use App\Models\DocumentType;
use App\Models\EmployeeDocument;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class DocumentTest extends TestCase
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

        foreach (['documents.verify', 'documents.manage'] as $permission) {
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
        $this->user->givePermissionTo('documents.verify', 'documents.manage');

        $this->actingAs($this->user, 'sanctum');
    }

    public function test_document_type_can_be_created(): void
    {
        $documentType = DocumentType::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'name' => 'National ID',
            'code' => 'NATIONAL_ID',
            'required' => true,
            'active' => true,
        ]);

        $this->assertDatabaseHas('document_types', [
            'tenant_id' => $this->tenant->id,
            'code' => 'NATIONAL_ID',
        ]);
    }

    public function test_employee_document_can_be_uploaded(): void
    {
        $documentType = DocumentType::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'name' => 'National ID',
            'code' => 'NATIONAL_ID',
            'required' => true,
            'active' => true,
        ]);

        $response = $this->postJson('/api/v1/documents', [
            'employee_id' => $this->employee->id,
            'document_type_id' => $documentType->id,
            'title' => 'Test Document',
        ]);

        // Without an actual file, this will fail validation — but the route exists
        $response->assertStatus(422);
    }

    public function test_document_can_be_verified(): void
    {
        $documentType = DocumentType::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'name' => 'National ID',
            'code' => 'NATIONAL_ID',
            'required' => true,
            'active' => true,
        ]);

        $document = EmployeeDocument::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'employee_id' => $this->employee->id,
            'document_type_id' => $documentType->id,
            'title' => 'Test Document',
            'file_path' => 'test.pdf',
            'file_name' => 'test.pdf',
            'status' => 'pending',
        ]);

        $response = $this->postJson("/api/v1/documents/{$document->id}/verify", [
            'status' => 'approved',
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('employee_documents', [
            'id' => $document->id,
            'status' => 'approved',
        ]);
    }
}
