<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('user_roles', function (Blueprint $table) {
            $table->foreignUuid('role_id')
                ->constrained('roles')
                ->cascadeOnDelete();

            $table->uuid('user_id');

            $table->string('model_type');

            $table->index([
                'user_id',
                'model_type',
            ]);

            $table->primary([
                'role_id',
                'user_id',
                'model_type',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_roles');
    }
};
