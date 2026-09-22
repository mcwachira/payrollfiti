<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leave_balances', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->foreignUuid('tenant_id')
                ->constrained('tenants')
                ->cascadeOnDelete();

            $table->foreignUuid('company_id')
                ->constrained('companies')
                ->cascadeOnDelete();

            $table->foreignUuid('employee_id')
                ->constrained('employees')
                ->restrictOnDelete();

            $table->foreignUuid('leave_type_id')
                ->constrained('leave_types')
                ->restrictOnDelete();

            $table->unsignedSmallInteger('year');

            $table->decimal('allocated_days', 8, 2)->default(0);
            $table->decimal('carried_forward_days', 8, 2)->default(0);
            $table->decimal('used_days', 8, 2)->default(0);
            $table->decimal('pending_days', 8, 2)->default(0);
            $table->decimal('available_days', 8, 2)->default(0);

            $table->timestampsTz();

            $table->unique([
                'employee_id',
                'leave_type_id',
                'year',
            ]);

            $table->index([
                'tenant_id',
                'company_id',
                'year',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('leave_balances');
    }
};
