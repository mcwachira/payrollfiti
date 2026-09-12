<?php

declare(strict_types=1);

namespace App\Domain\Documents\Services;

use App\Models\DocumentType;
use App\Models\DocumentVersion;
use App\Models\EmployeeDocument;
use App\Models\User;
use App\Support\TenantContext;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;

/**
 * DocumentService — manages employee document uploads and versioning
 * (Part 15 §15.4).
 *
 * Each upload creates a new DocumentVersion and updates the
 * EmployeeDocument's current file_path.
 */
final class DocumentService
{
    public function upload(
        string $employeeId,
        string $documentTypeId,
        UploadedFile $file,
        User $uploadedBy,
        array $metadata = []
    ): EmployeeDocument {
        $tenantId = TenantContext::current();

        $documentType = DocumentType::withoutTenantScope()
            ->where('id', $documentTypeId)
            ->firstOrFail();

        $fileName = $this->generateFileName($file, $documentType->code);
        $filePath = $this->storeFile($file, $documentType->code, $fileName);

        $employeeDocument = EmployeeDocument::create([
            'tenant_id' => $tenantId,
            'company_id' => $uploadedBy->tenant_id,
            'employee_id' => $employeeId,
            'document_type_id' => $documentTypeId,
            'file_path' => $filePath,
            'file_name' => $fileName,
            'file_size' => $file->getSize(),
            'mime_type' => $file->getMimeType(),
            'status' => 'pending',
            'metadata' => $metadata,
        ]);

        DocumentVersion::create([
            'tenant_id' => $tenantId,
            'employee_document_id' => $employeeDocument->id,
            'file_path' => $filePath,
            'file_name' => $fileName,
            'file_size' => $file->getSize(),
            'mime_type' => $file->getMimeType(),
            'uploaded_by' => $uploadedBy->id,
            'version_number' => 1,
        ]);

        return $employeeDocument;
    }

    public function addVersion(EmployeeDocument $document, UploadedFile $file, User $uploadedBy): DocumentVersion
    {
        $tenantId = TenantContext::current();

        $fileName = $this->generateFileName($file, $document->documentType->code);
        $filePath = $this->storeFile($file, $document->documentType->code, $fileName);

        $latestVersion = $document->versions()->latest('version_number')->first();
        $newVersionNumber = $latestVersion ? $latestVersion->version_number + 1 : 1;

        $document->update([
            'file_path' => $filePath,
            'file_name' => $fileName,
            'file_size' => $file->getSize(),
            'mime_type' => $file->getMimeType(),
        ]);

        return DocumentVersion::create([
            'tenant_id' => $tenantId,
            'employee_document_id' => $document->id,
            'file_path' => $filePath,
            'file_name' => $fileName,
            'file_size' => $file->getSize(),
            'mime_type' => $file->getMimeType(),
            'uploaded_by' => $uploadedBy->id,
            'version_number' => $newVersionNumber,
        ]);
    }

    public function verify(EmployeeDocument $document, User $verifier, string $status = 'approved'): void
    {
        $document->update([
            'status' => $status,
            'verified_at' => now(),
            'verified_by' => $verifier->id,
        ]);
    }

    public function getEmployeeDocuments(string $employeeId, ?string $documentTypeId = null): Collection
    {
        $query = EmployeeDocument::withoutTenantScope()
            ->where('tenant_id', TenantContext::current())
            ->where('employee_id', $employeeId);

        if ($documentTypeId) {
            $query->where('document_type_id', $documentTypeId);
        }

        return $query->latest()->get();
    }

    private function generateFileName(UploadedFile $file, string $code): string
    {
        return $code.'/'.Str::uuid().'.'.$file->getClientOriginalExtension();
    }

    private function storeFile(UploadedFile $file, string $code, string $fileName): string
    {
        return $file->storeAs("documents/{$code}", $fileName, 'documents');
    }
}
