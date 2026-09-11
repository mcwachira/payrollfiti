<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_types', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('company_id')->nullable()->constrained('companies')->nullOnDelete();
            $table->string('name');
            $table->string('code');
            $table->boolean('required')->default(false);
            $table->boolean('active')->default(true);
            $table->timestampsTz();
            $table->unique(['tenant_id', 'code']);
        });

        Schema::create('employee_documents', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('employee_id')->constrained('employees')->restrictOnDelete();
            $table->foreignUuid('document_type_id')->constrained('document_types')->restrictOnDelete();
            $table->foreignUuid('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title');
            $table->string('status')->default('active');
            $table->date('expires_on')->nullable();
            $table->timestampsTz();
            $table->softDeletesTz();
            $table->index(['tenant_id', 'company_id', 'employee_id']);
        });

        Schema::create('document_versions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('employee_document_id')->constrained('employee_documents')->cascadeOnDelete();
            $table->foreignUuid('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedInteger('version');
            $table->string('disk');
            $table->string('path');
            $table->string('original_filename');
            $table->string('mime_type', 255);
            $table->unsignedBigInteger('size');
            $table->string('checksum', 128);
            $table->timestampTz('uploaded_at');
            $table->timestampsTz();
            $table->unique(['employee_document_id', 'version']);
            $table->unique(['employee_document_id', 'checksum']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_versions');
        Schema::dropIfExists('employee_documents');
        Schema::dropIfExists('document_types');
    }
};
