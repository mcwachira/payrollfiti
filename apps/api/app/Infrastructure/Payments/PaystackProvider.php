<?php

namespace App\Infrastructure\Payments;

use App\Domain\Payments\Contracts\PaymentInitiationResult;
use App\Domain\Payments\Contracts\PaymentProvider;
use App\Domain\Payments\Contracts\PaymentRequest;
use App\Domain\Payments\Contracts\PaymentStatus;
use App\Domain\Payments\Contracts\WebhookEvent;
use App\Domain\Payments\Exceptions\WebhookVerificationException;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class PaystackProvider implements PaymentProvider
{
    public function __construct(
        private readonly CurlClient $client,
        private readonly Money $money,
    ) {}

    public function name(): string
    {
        return 'paystack';
    }

    private function isEnabled(): bool
    {
        return (bool) config('services.paystack.secret_key');
    }

    public function verifyWebhookSignature(Request $request): true
    {
        $payload = $request->getContent();
        $signature = $request->header('x-paystack-signature');

        if (! is_string($signature) || $signature === '') {
            throw WebhookVerificationException::for('Missing Paystack signature header.');
        }

        $secret = (string) (config('services.paystack.webhook_secret') ?: config('services.paystack.secret_key'));

        if ($secret === '') {
            throw WebhookVerificationException::for('Paystack webhook secret is not configured.');
        }

        if (! hash_equals(hash_hmac('sha512', $payload, $secret), $signature)) {
            throw WebhookVerificationException::for('Invalid Paystack signature.');
        }

        return true;
    }

    public function parseWebhook(Request $request): WebhookEvent
    {
        $payload = (array) json_decode($request->getContent(), true);

        $data = (array) ($payload['data'] ?? []);

        $status = match ($data['status'] ?? null) {
            'success' => PaymentStatus::Succeeded,
            'failed', 'abandoned' => PaymentStatus::Failed,
            default => PaymentStatus::Pending,
        };

        return new WebhookEvent(
            providerEventId: (string) ($data['id'] ?? $payload['id'] ?? $request->header('x-paystack-event') ?? 'unknown'),
            eventType: (string) ($payload['event'] ?? 'unknown'),
            reference: isset($data['reference']) ? (string) $data['reference'] : null,
            status: $status,
            providerTransactionId: isset($data['id']) ? (string) $data['id'] : null,
            rawPayload: $request->getContent(),
        );
    }

    public function initiate(PaymentRequest $request): PaymentInitiationResult
    {
        if (! $this->isEnabled()) {
            return new PaymentInitiationResult(false, null, null, null, 'Paystack is not configured.');
        }

        try {
            $response = $this->client->json('POST', 'https://api.paystack.co/transaction/initialize', [
                'Authorization' => 'Bearer '.config('services.paystack.secret_key'),
                'Content-Type' => 'application/json',
            ], [
                'reference' => $request->reference,
                'amount' => $this->money->toMinor($request->amount),
                'currency' => $request->currency,
                'email' => $request->email ?? 'billing@example.com',
                'callback_url' => $request->callbackUrl ?? config('app.url').'/billing/payment-result',
                'metadata' => ['reference' => $request->reference],
            ]);
        } catch (\Throwable $e) {
            Log::error('paystack.initiate.failed', ['reference' => $request->reference, 'error' => $e->getMessage()]);

            return new PaymentInitiationResult(false, null, null, null, $e->getMessage());
        }

        $body = (array) ($response['body'] ?? []);

        if (($response['status'] ?? 0) >= 400 || ! (bool) ($body['status'] ?? false)) {
            Log::error('paystack.initiate.error', ['reference' => $request->reference, 'response' => $body]);

            return new PaymentInitiationResult(false, null, null, json_encode($body), (string) ($body['message'] ?? 'Paystack initialization failed.'));
        }

        $data = (array) ($body['data'] ?? []);

        return new PaymentInitiationResult(
            success: true,
            providerReference: isset($data['reference']) ? (string) $data['reference'] : null,
            authorizationUrl: isset($data['authorization_url']) ? (string) $data['authorization_url'] : null,
            providerResponse: json_encode($body),
            error: null,
        );
    }

    public function reconcilePayment(string $providerReference): PaymentStatus
    {
        if (! $this->isEnabled()) {
            return PaymentStatus::Pending;
        }

        try {
            $response = $this->client->json('GET', 'https://api.paystack.co/transaction/verify/'.rawurlencode($providerReference), [
                'Authorization' => 'Bearer '.config('services.paystack.secret_key'),
                'Accept' => 'application/json',
            ]);
        } catch (\Throwable $e) {
            Log::error('paystack.reconcile.failed', ['reference' => $providerReference, 'error' => $e->getMessage()]);

            return PaymentStatus::Pending;
        }

        $body = (array) ($response['body'] ?? []);

        if (($response['status'] ?? 0) >= 400 || ! (bool) ($body['status'] ?? false)) {
            return PaymentStatus::Pending;
        }

        $data = (array) ($body['data'] ?? []);

        return match ($data['status'] ?? null) {
            'success' => PaymentStatus::Succeeded,
            'failed', 'abandoned' => PaymentStatus::Failed,
            default => PaymentStatus::Pending,
        };
    }
}
