<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('loan_repayments', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->foreignUuid('tenant_id')
                ->constrained('tenants')
                ->cascadeOnDelete();

            $table->foreignUuid('loan_id')
                ->constrained('loans')
                ->restrictOnDelete();

            $table->foreignUuid('payroll_entry_id')
                ->nullable()
                ->constrained('payroll_entries')
                ->nullOnDelete();

            $table->unsignedSmallInteger('installment_number');

            $table->date('due_date');

            $table->decimal('principal_amount', 18, 2);
            $table->decimal('interest_amount', 18, 2)->default(0);
            $table->decimal('total_amount', 18, 2);
            $table->decimal('paid_amount', 18, 2)->default(0);

            $table->string('status')->default('scheduled');

            $table->timestampTz('paid_at')->nullable();

            $table->timestampsTz();

            $table->unique([
                'loan_id',
                'installment_number',
            ]);

            $table->index([
                'tenant_id',
                'status',
                'due_date',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loan_repayments');
    }
};
