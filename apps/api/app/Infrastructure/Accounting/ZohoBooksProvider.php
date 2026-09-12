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

final class ZohoBooksProvider implements AccountingProvider
{
    public function name(): string
    {
        return 'zoho_books';
    }

    public function redirect(): RedirectResponse
    {
        return Socialite::driver('zoho-books')->redirect();
    }

    public function callback(): array
    {
        $user = Socialite::driver('zoho-books')->user();

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
            return SyncResult::pendingExternal('zoho_credentials_not_configured');
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
                    return SyncResult::failed('zoho_token_refresh_failed');
                }

                $accessToken = $refreshed;
            }

            $payload = $this->buildPayrollRunPayload($run, $mappings);

            $response = Http::withToken($accessToken)
                ->timeout(30)
                ->post('https://books.zoho.com/api/v3/journalentries', $payload);

            if ($response->successful()) {
                $body = $response->json();

                return SyncResult::synced(
                    (string) ($body['journal_entry']['journal_entry_id'] ?? ''),
                    $payload,
                );
            }

            return SyncResult::failed(
                'zoho_api_error: '.$response->status(),
                ['response' => $response->body()],
            );
        } catch (\Throwable $e) {
            Log::error('zoho.sync_payroll_run_failed', [
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
            return SyncResult::pendingExternal('zoho_credentials_not_configured');
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
                    return SyncResult::failed('zoho_token_refresh_failed');
                }

                $accessToken = $refreshed;
            }

            $payload = $this->buildInvoicePayload($invoice, $mappings);

            $response = Http::withToken($accessToken)
                ->timeout(30)
                ->post('https://books.zoho.com/api/v3/invoices', $payload);

            if ($response->successful()) {
                $body = $response->json();

                return SyncResult::synced(
                    (string) ($body['invoice']['invoice_id'] ?? ''),
                    $payload,
                );
            }

            return SyncResult::failed(
                'zoho_api_error: '.$response->status(),
                ['response' => $response->body()],
            );
        } catch (\Throwable $e) {
            Log::error('zoho.sync_invoice_failed', [
                'tenant_id' => $invoice->tenant_id,
                'invoice_id' => $invoice->id,
                'error' => $e->getMessage(),
            ]);

            return SyncResult::failed($e->getMessage());
        }
    }

    private function isEnabled(): bool
    {
        return (bool) config('services.zoho_books.client_id');
    }

    private function resolveConnection(string $tenantId): ?AccountingConnection
    {
        return AccountingConnection::withoutTenantScope()
            ->where('tenant_id', $tenantId)
            ->where('provider', 'zoho_books')
            ->where('status', 'active')
            ->first();
    }

    private function refreshToken(AccountingConnection $connection): ?string
    {
        try {
            $refreshToken = decrypt($connection->refresh_token_encrypted);
            $region = config('services.zoho_books.region', 'com');

            $response = Http::asForm()->post("https://accounts.zoho{$region}.com/oauth/v2/token", [
                'grant_type' => 'refresh_token',
                'refresh_token' => $refreshToken,
                'client_id' => config('services.zoho_books.client_id'),
                'client_secret' => config('services.zoho_books.client_secret'),
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
            Log::error('zoho.token_refresh_failed', [
                'tenant_id' => $connection->tenant_id,
                'error' => $e->getMessage(),
            ]);
        }

        return null;
    }

    private function buildPayrollRunPayload(PayrollRun $run, array $mappings): array
    {
        $mapping = $mappings['payroll_expense_account'] ?? 'Payroll Expenses';

        return [
            'journal_entry' => [
                'date' => $run->pay_date?->toDateString() ?? now()->toDateString(),
                'reference_number' => 'PR-'.$run->id,
                'line_items' => [
                    [
                        'account_id' => $mapping,
                        'debit' => (float) $run->total_net_pay,
                        'description' => 'Payroll - '.$run->period_start->format('Y-m-d').' to '.$run->period_end->format('Y-m-d'),
                    ],
                ],
            ],
        ];
    }

    private function buildInvoicePayload(object $invoice, array $mappings): array
    {
        $mapping = $mappings['income_account'] ?? 'Sales';

        return [
            'invoice' => [
                'customer_id' => $invoice->customer_id ?? null,
                'date' => now()->toDateString(),
                'due_date' => now()->addDays(30)->toDateString(),
                'line_items' => [
                    [
                        'account_id' => $mapping,
                        'rate' => (float) ($invoice->amount ?? 0),
                        'quantity' => 1,
                        'description' => $invoice->description ?? '',
                    ],
                ],
            ],
        ];
    }
}
