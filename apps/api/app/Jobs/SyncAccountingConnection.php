<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Accounting\AccountingProviderManager;
use App\Domain\Accounting\Contracts\AccountingProvider;
use App\Domain\Accounting\Contracts\SyncResult;
use App\Domain\Accounting\Contracts\SyncStatus;
use App\Models\AccountingConnection;
use App\Models\AccountingSyncJob;
use App\Models\AccountingSyncRecord;
use App\Models\PayrollRun;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Sync one entity (payroll_run or invoice) into one external accounting
 * connection (Part 13 §13.5 / §13.6 / Part 19).
 *
 * Idempotency model:
 *  - accounting_sync_records.(sync_job_id, entity_type, local_id) is UNIQUE,
 *    so re-delivery after a provider timeout can never double-record.
 *  - A connection with no credentials yet is skipped deterministically and
 *    recorded as pending_external instead of failing the pipeline.
 *
 * Each connection/provider is independent: a failure in Xero does not block
 * QuickBooks sync for the same payroll run.
 */
final class SyncAccountingConnection extends TenantAwareJob implements ShouldBeUnique
{
    public string $connectionId;

    public string $entityType;

    public string $entityId;

    public function __construct(string $tenantId, string $connectionId, string $entityType, string $entityId)
    {
        $this->tenantId = $tenantId;
        $this->connectionId = $connectionId;
        $this->entityType = $entityType;
        $this->entityId = $entityId;
        $this->timeout = 240;
        $this->onQueue('integrations');
    }

    public function uniqueId(): string
    {
        return $this->connectionId.':'.$this->entityType.':'.$this->entityId;
    }

    public function uniqueFor(): int
    {
        return 3600;
    }

    public function middleware(): array
    {
        return [new WithoutOverlapping($this->uniqueId(), 3600)];
    }

    public function backoff(): array
    {
        return [30, 120, 600, 3600];
    }

    protected function execute(): void
    {
        $connection = AccountingConnection::withoutTenantScope()
            ->where('tenant_id', $this->tenantId)
            ->find($this->connectionId);

        if ($connection === null || $connection->status !== 'active') {
            return;
        }

        $job = AccountingSyncJob::withoutTenantScope()
            ->where('tenant_id', $this->tenantId)
            ->where('accounting_connection_id', $connection->id)
            ->where('entity_type', $this->entityType)
            ->where('filters->entity_id', $this->entityId)
            ->first();

        if ($job === null) {
            $job = AccountingSyncJob::create([
                'tenant_id' => $this->tenantId,
                'accounting_connection_id' => $connection->id,
                'entity_type' => $this->entityType,
                'filters' => ['entity_id' => $this->entityId],
                'status' => 'pending',
            ]);
        }

        $record = AccountingSyncRecord::withoutTenantScope()->firstOrCreate(
            [
                'accounting_sync_job_id' => $job->id,
                'entity_type' => $this->entityType,
                'local_id' => $this->entityId,
            ],
            [
                'tenant_id' => $this->tenantId,
                'status' => 'pending',
            ],
        );

        $job->update(['status' => 'running', 'started_at' => now()]);

        if ($connection->access_token_encrypted === null) {
            $record->update([
                'status' => 'pending_external',
                'response' => ['reason' => 'accounting_connection_missing_credentials'],
            ]);
            $job->update(['status' => 'pending_external', 'completed_at' => now()]);

            return;
        }

        $manager = app(AccountingProviderManager::class);

        if (! $manager->has($connection->provider)) {
            $record->update([
                'status' => 'failed',
                'error' => 'Provider ['.$connection->provider.'] is not configured.',
            ]);
            $job->update(['status' => 'failed', 'error' => 'Provider not configured', 'completed_at' => now()]);

            return;
        }

        /** @var AccountingProvider $provider */
        $provider = $manager->get($connection->provider);

        $mappings = $this->loadMappings($connection);

        try {
            $result = match ($this->entityType) {
                'payroll_run' => $provider->syncPayrollRun(
                    PayrollRun::withoutTenantScope()->findOrFail($this->entityId),
                    $mappings,
                ),
                'invoice' => $provider->syncInvoice(
                    (object) ['tenant_id' => $this->tenantId, 'id' => $this->entityId],
                    $mappings,
                ),
                default => SyncResult::skipped('unsupported_entity_type: '.$this->entityType),
            };

            $record->update([
                'status' => $result->status->value,
                'external_id' => $result->externalId ?: null,
                'error' => $result->error,
                'response' => $result->payload,
            ]);

            $job->update([
                'status' => match ($result->status) {
                    SyncStatus::Synced => 'completed',
                    SyncStatus::Failed => 'failed',
                    default => 'completed',
                },
                'error' => $result->error,
                'completed_at' => now(),
            ]);
        } catch (Throwable $e) {
            $record->update([
                'status' => 'failed',
                'error' => $e->getMessage(),
            ]);
            $job->update([
                'status' => 'failed',
                'error' => $e->getMessage(),
                'completed_at' => now(),
            ]);

            throw $e;
        }
    }

    /**
     * @return array<string, string>
     */
    private function loadMappings(AccountingConnection $connection): array
    {
        $mappings = [];

        foreach ($connection->mappings as $mapping) {
            $mappings[$mapping->local_code] = $mapping->external_code;
        }

        return $mappings;
    }

    public function failed(Throwable $exception): void
    {
        AccountingSyncRecord::withoutTenantScope()
            ->whereHas('syncJob', fn ($q) => $q->where('accounting_connection_id', $this->connectionId))
            ->where('entity_type', $this->entityType)
            ->where('local_id', $this->entityId)
            ->update(['status' => 'failed']);

        Log::error('sync_accounting.failed', [
            'tenant_id' => $this->tenantId,
            'connection_id' => $this->connectionId,
            'entity_type' => $this->entityType,
            'entity_id' => $this->entityId,
            'error' => $exception->getMessage(),
        ]);
    }
}
