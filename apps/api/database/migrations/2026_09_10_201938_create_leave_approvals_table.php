<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leave_approvals', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->foreignUuid('tenant_id')
                ->constrained('tenants')
                ->cascadeOnDelete();

            $table->foreignUuid('leave_request_id')
                ->constrained('leave_requests')
                ->cascadeOnDelete();

            $table->foreignUuid('approver_id')
                ->constrained('users')
                ->restrictOnDelete();

            $table->string('status');

            $table->text('comments')->nullable();

            $table->timestampTz('decided_at')->nullable();

            $table->timestampsTz();

            $table->unique([
                'leave_request_id',
                'approver_id',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('leave_approvals');
    }
};
