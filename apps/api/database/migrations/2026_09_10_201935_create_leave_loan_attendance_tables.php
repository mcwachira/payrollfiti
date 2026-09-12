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
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('employee_id')->constrained('employees')->restrictOnDelete();
            $table->foreignUuid('leave_type_id')->constrained('leave_types')->restrictOnDelete();
            $table->unsignedSmallInteger('year');
            $table->decimal('allocated_days', 8, 2)->default(0);
            $table->decimal('carried_forward_days', 8, 2)->default(0);
            $table->decimal('used_days', 8, 2)->default(0);
            $table->decimal('pending_days', 8, 2)->default(0);
            $table->decimal('available_days', 8, 2)->default(0);
            $table->timestampsTz();
            $table->unique(['employee_id', 'leave_type_id', 'year']);
            $table->index(['tenant_id', 'company_id', 'year']);
        });

        Schema::create('leave_requests', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('employee_id')->constrained('employees')->restrictOnDelete();
            $table->foreignUuid('leave_type_id')->constrained('leave_types')->restrictOnDelete();
            $table->foreignUuid('submitted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->date('start_date');
            $table->date('end_date');
            $table->decimal('days_requested', 8, 2);
            $table->text('reason')->nullable();
            $table->string('status')->default('pending');
            $table->timestampTz('cancelled_at')->nullable();
            $table->timestampTz('approved_at')->nullable();
            $table->timestampsTz();
            $table->index(['tenant_id', 'company_id', 'status']);
            $table->index(['employee_id', 'start_date', 'end_date']);
        });

        Schema::create('leave_approvals', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('leave_request_id')->constrained('leave_requests')->cascadeOnDelete();
            $table->foreignUuid('approver_id')->constrained('users')->restrictOnDelete();
            $table->string('status');
            $table->text('comments')->nullable();
            $table->timestampTz('decided_at')->nullable();
            $table->timestampsTz();
            $table->unique(['leave_request_id', 'approver_id']);
        });

        Schema::create('public_holidays', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('company_id')->nullable()->constrained('companies')->nullOnDelete();
            $table->string('country', 2);
            $table->string('name');
            $table->date('holiday_date');
            $table->boolean('is_paid')->default(true);
            $table->timestampsTz();
            $table->unique(['tenant_id', 'company_id', 'holiday_date']);
            $table->index(['tenant_id', 'country', 'holiday_date']);
        });

        Schema::create('loan_products', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('name');
            $table->string('code');
            $table->decimal('maximum_principal', 18, 2)->nullable();
            $table->decimal('annual_interest_rate', 8, 4)->default(0);
            $table->unsignedSmallInteger('maximum_term_months')->nullable();
            $table->boolean('active')->default(true);
            $table->jsonb('rules')->nullable();
            $table->timestampsTz();
            $table->unique(['company_id', 'code']);
        });

        Schema::create('loans', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('employee_id')->constrained('employees')->restrictOnDelete();
            $table->foreignUuid('loan_product_id')->constrained('loan_products')->restrictOnDelete();
            $table->foreignUuid('approved_by')->nullable()->constrained('users')->nullOnDelete();
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
            $table->index(['tenant_id', 'company_id', 'status']);
            $table->index(['employee_id', 'status']);
        });

        Schema::create('loan_repayments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('loan_id')->constrained('loans')->restrictOnDelete();
            $table->foreignUuid('payroll_entry_id')->nullable()->constrained('payroll_entries')->nullOnDelete();
            $table->unsignedSmallInteger('installment_number');
            $table->date('due_date');
            $table->decimal('principal_amount', 18, 2);
            $table->decimal('interest_amount', 18, 2)->default(0);
            $table->decimal('total_amount', 18, 2);
            $table->decimal('paid_amount', 18, 2)->default(0);
            $table->string('status')->default('scheduled');
            $table->timestampTz('paid_at')->nullable();
            $table->timestampsTz();
            $table->unique(['loan_id', 'installment_number']);
            $table->index(['tenant_id', 'status', 'due_date']);
        });

        Schema::create('attendance_policies', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('name');
            $table->string('timezone')->default('Africa/Nairobi');
            $table->jsonb('schedule');
            $table->unsignedSmallInteger('grace_minutes')->default(0);
            $table->boolean('active')->default(true);
            $table->timestampsTz();
            $table->unique(['company_id', 'name']);
        });

        Schema::create('attendance_records', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('employee_id')->constrained('employees')->restrictOnDelete();
            $table->foreignUuid('attendance_policy_id')->nullable()->constrained('attendance_policies')->nullOnDelete();
            $table->date('attendance_date');
            $table->timestampTz('clocked_in_at')->nullable();
            $table->timestampTz('clocked_out_at')->nullable();
            $table->decimal('regular_hours', 8, 2)->default(0);
            $table->decimal('overtime_hours', 8, 2)->default(0);
            $table->string('status')->default('present');
            $table->jsonb('metadata')->nullable();
            $table->timestampsTz();
            $table->unique(['employee_id', 'attendance_date']);
            $table->index(['tenant_id', 'company_id', 'attendance_date']);
        });

        Schema::create('timesheets', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('employee_id')->constrained('employees')->restrictOnDelete();
            $table->foreignUuid('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->date('period_start');
            $table->date('period_end');
            $table->decimal('regular_hours', 8, 2)->default(0);
            $table->decimal('overtime_hours', 8, 2)->default(0);
            $table->string('status')->default('draft');
            $table->timestampTz('approved_at')->nullable();
            $table->jsonb('summary')->nullable();
            $table->timestampsTz();
            $table->unique(['employee_id', 'period_start', 'period_end']);
            $table->index(['tenant_id', 'company_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('timesheets');
        Schema::dropIfExists('attendance_records');
        Schema::dropIfExists('attendance_policies');
        Schema::dropIfExists('loan_repayments');
        Schema::dropIfExists('loans');
        Schema::dropIfExists('loan_products');
        Schema::dropIfExists('public_holidays');
        Schema::dropIfExists('leave_approvals');
        Schema::dropIfExists('leave_requests');
        Schema::dropIfExists('leave_balances');
    }
};
