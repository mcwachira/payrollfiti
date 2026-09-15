<?php

declare(strict_types=1);

namespace App\Domain\Accounting\Contracts;

final readonly class SyncResult
{
    public function __construct(
        public SyncStatus $status,
        public string $externalId,
        public array $payload,
        public ?string $error = null,
    ) {}

    public static function synced(string $externalId, array $payload = []): self
    {
        return new self(SyncStatus::Synced, $externalId, $payload);
    }

    public static function failed(string $error, array $payload = []): self
    {
        return new self(SyncStatus::Failed, '', $payload, $error);
    }

    public static function skipped(string $reason, array $payload = []): self
    {
        return new self(SyncStatus::Skipped, '', $payload, $reason);
    }

    public static function pendingExternal(string $reason, array $payload = []): self
    {
        return new self(SyncStatus::PendingExternal, '', $payload, $reason);
    }
}
