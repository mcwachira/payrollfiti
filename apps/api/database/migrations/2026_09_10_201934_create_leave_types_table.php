<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leave_types', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->foreignUuid('tenant_id')
                ->constrained('tenants')
                ->cascadeOnDelete();

            $table->foreignUuid('company_id')
                ->constrained('companies')
                ->cascadeOnDelete();

            $table->string('name');
            $table->string('code');

            $table->text('description')->nullable();

            $table->decimal('default_days_per_year', 8, 2)->default(0);

            $table->string('accrual_type')->default('annual');
            $table->string('approval_type')->default('manager');

            $table->boolean('is_paid')->default(true);
            $table->boolean('allow_carry_forward')->default(false);

            $table->decimal('maximum_carry_forward_days', 8, 2)
                ->nullable();

            $table->boolean('requires_document')->default(false);

            $table->boolean('is_active')->default(true);

            $table->jsonb('rules')->nullable();

            $table->timestampsTz();
            $table->softDeletesTz();

            $table->unique([
                'company_id',
                'code',
            ]);

            $table->index([
                'tenant_id',
                'company_id',
                'is_active',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('leave_types');
    }
};
