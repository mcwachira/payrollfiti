<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('loans', function (Blueprint $table): void {
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

            $table->foreignUuid('loan_product_id')
                ->constrained('loan_products')
                ->restrictOnDelete();

            $table->foreignUuid('approved_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->decimal('principal_amount', 18, 2);
            $table->decimal('interest_amount', 18, 2)->default(0);
            $table->decimal('total_amount', 18, 2);
            $table->decimal('outstanding_amount', 18, 2);

            $table->unsignedSmallInteger('term_months');

            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();

            $table->string('status')->default('pending');

            $table->timestampTz('approved_at')->nullable();
            $table->text('approval_notes')->nullable();

            $table->timestampsTz();

            $table->index([
                'tenant_id',
                'company_id',
                'status',
            ]);

            $table->index([
                'employee_id',
                'status',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loans');
    }
};
