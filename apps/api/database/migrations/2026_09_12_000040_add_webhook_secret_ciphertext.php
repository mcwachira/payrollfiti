<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Part 13 — Queues, Redis & Messaging.
 *
 * Outbound webhook delivery (DeliverWebhook) signs each POST's raw body with
 * HMAC-SHA-256 keyed by the endpoint's shared secret so the tenant's receiver
 * can verify origin authenticity. The plaintext secret is needed at signing
 * time, so we keep an encrypted ciphertext copy (AES-256 via APP_KEY) next to
 * the existing irreversible secret_hash — the hash remains the authoritative
 * comparison for endpoint registration, and secret_ciphertext enables signing
 * without ever storing the plaintext.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('webhook_endpoints', function (Blueprint $table): void {
            $table->text('secret_ciphertext')->nullable()->after('secret_hash');
        });
    }

    public function down(): void
    {
        Schema::table('webhook_endpoints', function (Blueprint $table): void {
            $table->dropColumn('secret_ciphertext');
        });
    }
};
