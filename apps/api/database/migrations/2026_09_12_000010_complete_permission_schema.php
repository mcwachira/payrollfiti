<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('model_has_permissions', function (Blueprint $table): void {
            $table->foreignUuid('user_id')
                ->constrained('users')
                ->cascadeOnDelete();

            $table->string('model_type');

            $table->foreignUuid('permission_id')
                ->constrained('permissions')
                ->cascadeOnDelete();

            $table->primary([
                'user_id',
                'model_type',
                'permission_id',
            ]);

            $table->index('permission_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('model_has_permissions');
    }
};
