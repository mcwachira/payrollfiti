<?php

declare(strict_types=1);

namespace App\Infrastructure\Accounting;

use App\Domain\Accounting\Contracts\AccountingProvider;
use App\Domain\Accounting\Contracts\SyncResult;
use App\Models\AccountingConnection;
use App\Models\PayrollRun;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Laravel\Socialite\Facades\Socialite;
use Symfony\Component\HttpFoundation\RedirectResponse;

final class XeroProvider implements AccountingProvider
{
    public function name(): string
    {
        return 'xero';
    }

    public function redirect(): RedirectResponse
    {
        return Socialite::driver('xero')->redirect();
    }

    public function callback(): array
    {
        $user = Socialite::driver('xero')->user();

        return [
            'access_token' => $user->token,
            'refresh_token' => $user->refreshToken,
            'expires_at' => $user->expiresIn ? now()->addSeconds($user->expiresIn) : null,
            'external_account_id' => $user->id,
        ];
    }

    public function syncPayrollRun(PayrollRun $run, array $mappings): SyncResult
    {
        if (! $this->isEnabled()) {
            return SyncResult::pendingExternal('xero_credentials_not_configured');
        }

        try {
            $connection = $this->resolveConnection($run->tenant_id);

            if ($connection === null || $connection->access_token_encrypted === null) {
                return SyncResult::pendingExternal('accounting_connection_missing_credentials');
            }

            $accessToken = decrypt($connection->access_token_encrypted);

            if ($connection->token_expires_at?->isPast()) {
                $refreshed = $this->refreshToken($connection);

                if ($refreshed === null) {
                    return SyncResult::failed('xero_token_refresh_failed');
                }

                $accessToken = $refreshed;
            }

            $payload = $this->buildPayrollRunPayload($run, $mappings);

            $response = Http::withToken($accessToken)
                ->timeout(30)
                ->post('https://api.xero.com/api.xro/2.0/ManualJournals', $payload);

            if ($response->successful()) {
                $body = $response->json();

                return SyncResult::synced(
                    (string) ($body['ManualJournals'][0]['ManualJournalID'] ?? ''),
                    $payload,
                );
            }

            return SyncResult::failed(
                'xero_api_error: '.$response->status(),
                ['response' => $response->body()],
            );
        } catch (\Throwable $e) {
            Log::error('xero.sync_payroll_run_failed', [
                'tenant_id' => $run->tenant_id,
                'payroll_run_id' => $run->id,
                'error' => $e->getMessage(),
            ]);

            return SyncResult::failed($e->getMessage());
        }
    }

    public function syncInvoice(object $invoice, array $mappings): SyncResult
    {
        if (! $this->isEnabled()) {
            return SyncResult::pendingExternal('xero_credentials_not_configured');
        }

        try {
            $connection = $this->resolveConnection($invoice->tenant_id);

            if ($connection === null || $connection->access_token_encrypted === null) {
                return SyncResult::pendingExternal('accounting_connection_missing_credentials');
            }

            $accessToken = decrypt($connection->access_token_encrypted);

            if ($connection->token_expires_at?->isPast()) {
                $refreshed = $this->refreshToken($connection);

                if ($refreshed === null) {
                    return SyncResult::failed('xero_token_refresh_failed');
                }

                $accessToken = $refreshed;
            }

            $payload = $this->buildInvoicePayload($invoice, $mappings);

            $response = Http::withToken($accessToken)
                ->timeout(30)
                ->post('https://api.xero.com/api.xro/2.0/Invoices', $payload);

            if ($response->successful()) {
                $body = $response->json();

                return SyncResult::synced(
                    (string) ($body['Invoices'][0]['InvoiceID'] ?? ''),
                    $payload,
                );
            }

            return SyncResult::failed(
                'xero_api_error: '.$response->status(),
                ['response' => $response->body()],
            );
        } catch (\Throwable $e) {
            Log::error('xero.sync_invoice_failed', [
                'tenant_id' => $invoice->tenant_id,
                'invoice_id' => $invoice->id,
                'error' => $e->getMessage(),
            ]);

            return SyncResult::failed($e->getMessage());
        }
    }

    private function isEnabled(): bool
    {
        return (bool) config('services.xero.client_id');
    }

    private function resolveConnection(string $tenantId): ?AccountingConnection
    {
        return AccountingConnection::withoutTenantScope()
            ->where('tenant_id', $tenantId)
            ->where('provider', 'xero')
            ->where('status', 'active')
            ->first();
    }

    private function refreshToken(AccountingConnection $connection): ?string
    {
        try {
            $refreshToken = decrypt($connection->refresh_token_encrypted);

            $response = Http::asForm()->post('https://identity.xero.com/connect/token', [
                'grant_type' => 'refresh_token',
                'refresh_token' => $refreshToken,
                'client_id' => config('services.xero.client_id'),
                'client_secret' => config('services.xero.client_secret'),
            ]);

            if ($response->successful()) {
                $data = $response->json();

                $connection->update([
                    'access_token_encrypted' => encrypt($data['access_token']),
                    'refresh_token_encrypted' => encrypt($data['refresh_token']),
                    'token_expires_at' => now()->addSeconds((int) $data['expires_in']),
                ]);

                return $data['access_token'];
            }
        } catch (\Throwable $e) {
            Log::error('xero.token_refresh_failed', [
                'tenant_id' => $connection->tenant_id,
                'error' => $e->getMessage(),
            ]);
        }

        return null;
    }

    private function buildPayrollRunPayload(PayrollRun $run, array $mappings): array
    {
        $mapping = $mappings['payroll_expense_account'] ?? 'EXPENSE';

        return [
            'ManualJournals' => [
                [
                    'Date' => $run->pay_date?->toDateString() ?? now()->toDateString(),
                    'Narration' => 'Payroll run #'.$run->id,
                    'Status' => 'DRAFT',
                    'LineAmountTypes' => 'Inclusive',
                    'JournalLines' => [
                        [
                            'AccountCode' => $mapping,
                            'LineAmount' => (string) $run->total_net_pay,
                            'Description' => 'Payroll - '.$run->period_start->format('Y-m-d').' to '.$run->period_end->format('Y-m-d'),
                        ],
                    ],
                ],
            ],
        ];
    }

    private function buildInvoicePayload(object $invoice, array $mappings): array
    {
        $mapping = $mappings['income_account'] ?? 'REVENUE';

        return [
            'Invoices' => [
                [
                    'Type' => 'ACCREC',
                    'Contact' => ['Name' => $invoice->customer_name ?? 'Customer'],
                    'Date' => now()->toDateString(),
                    'DueDate' => now()->addDays(30)->toDateString(),
                    'LineAmountTypes' => 'Inclusive',
                    'Status' => 'DRAFT',
                    'LineItems' => [
                        [
                            'AccountCode' => $mapping,
                            'Description' => $invoice->description ?? '',
                            'Quantity' => 1.0,
                            'UnitAmount' => (string) ($invoice->amount ?? 0),
                        ],
                    ],
                ],
            ],
        ];
    }
}
