<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Spatie\Permission expects `guard_name` on the `roles` and `permissions`
     * tables and a morph pivot table for direct user permissions. The original
     * schema omitted these, which made every permission lookup fail at runtime.
     */
    public function up(): void
    {
        if (! Schema::hasColumn('permissions', 'guard_name')) {
            Schema::table('permissions', function (Blueprint $table): void {
                $table->string('guard_name')->default('web');
            });
        }

        if (! Schema::hasColumn('roles', 'guard_name')) {
            Schema::table('roles', function (Blueprint $table): void {
                $table->string('guard_name')->default('web');
            });
        }

        Schema::create('model_has_permissions', function (Blueprint $table): void {
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('model_type');
            $table->foreignUuid('permission_id')->constrained('permissions')->cascadeOnDelete();

            $table->primary(['user_id', 'model_type', 'permission_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('model_has_permissions');

        if (Schema::hasColumn('roles', 'guard_name')) {
            Schema::table('roles', function (Blueprint $table): void {
                $table->dropColumn('guard_name');
            });
        }

        if (Schema::hasColumn('permissions', 'guard_name')) {
            Schema::table('permissions', function (Blueprint $table): void {
                $table->dropColumn('guard_name');
            });
        }
    }
};
