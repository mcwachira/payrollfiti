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

class MpesaProvider implements PaymentProvider
{
    private const TOKEN_CACHE_KEY = 'mpesa_access_token';

    public function __construct(
        private readonly CurlClient $client,
        private readonly Money $money,
    ) {}

    public function name(): string
    {
        return 'mpesa';
    }

    private function isEnabled(): bool
    {
        return (bool) config('services.mpesa.consumer_key') && (bool) config('services.mpesa.consumer_secret');
    }

    private function baseUrl(): string
    {
        return (string) config('services.mpesa.base_url', 'https://sandbox.safaricom.co.ke');
    }

    private function accessToken(): string
    {
        return cache()->remember(self::TOKEN_CACHE_KEY, now()->addMinutes(50), function () {
            $response = $this->client->json('GET', $this->baseUrl().'/oauth/v1/generate?grant_type=client_credentials', [
                'Authorization' => 'Basic '.base64_encode(config('services.mpesa.consumer_key').':'.config('services.mpesa.consumer_secret')),
                'Accept' => 'application/json',
            ]);

            if (($response['status'] ?? 0) >= 400) {
                throw new \RuntimeException('M-Pesa token request failed.');
            }

            return (string) ($response['body']['access_token'] ?? '');
        });
    }

    public function verifyWebhookSignature(Request $request): true
    {
        $token = (string) config('services.mpesa.callback_token');

        $callbackToken = $request->header('x-callback-token', $request->header('Authorization'));

        if ($token === '' || ! hash_equals($token, $callbackToken)) {
            throw WebhookVerificationException::for('Invalid M-Pesa callback token.');
        }

        return true;
    }

    public function parseWebhook(Request $request): WebhookEvent
    {
        $payload = (array) json_decode($request->getContent(), true);

        $body = (array) ($payload['Body'] ?? $payload);
        $stkCallback = (array) ($body['stkCallback'] ?? []);

        $resultCode = (int) ($stkCallback['ResultCode'] ?? -1);

        $status = $resultCode === 0 ? PaymentStatus::Succeeded : PaymentStatus::Failed;

        $checkoutRequestId = (string) ($stkCallback['CheckoutRequestID'] ?? 'unknown');

        $callbackMetadata = (array) ($stkCallback['CallbackMetadata'] ?? []);
        $items = (array) ($callbackMetadata['Item'] ?? []);

        $transactionId = null;
        $accountReference = null;
        foreach ($items as $item) {
            $item = (array) $item;
            if (($item['Name'] ?? null) === 'MpesaReceiptNumber') {
                $transactionId = isset($item['Value']) ? (string) $item['Value'] : null;
            }
            if (($item['Name'] ?? null) === 'AccountReference') {
                $accountReference = isset($item['Value']) ? (string) $item['Value'] : null;
            }
        }

        return new WebhookEvent(
            providerEventId: $checkoutRequestId,
            eventType: 'stk_push',
            reference: $accountReference,
            status: $status,
            providerTransactionId: $transactionId,
            rawPayload: $request->getContent(),
        );
    }

    public function initiate(PaymentRequest $request): PaymentInitiationResult
    {
        if (! $this->isEnabled()) {
            return new PaymentInitiationResult(false, null, null, null, 'M-Pesa is not configured.');
        }

        $shortCode = (string) config('services.mpesa.shortcode');
        $passKey = (string) config('services.mpesa.passkey');

        if ($shortCode === '' || $passKey === '') {
            return new PaymentInitiationResult(false, null, null, null, 'M-Pesa payment is not configured.');
        }

        $timestamp = now()->format('YmdHis');
        $password = base64_encode($shortCode.$passKey.$timestamp);

        try {
            $response = $this->client->json('POST', $this->baseUrl().'/mpesa/stkpush/v1/processrequest', [
                'Authorization' => 'Bearer '.$this->accessToken(),
                'Content-Type' => 'application/json',
            ], [
                'BusinessShortCode' => $shortCode,
                'Password' => $password,
                'Timestamp' => $timestamp,
                'TransactionType' => 'CustomerPayBillOnline',
                'Amount' => (string) $this->money->toMinor($request->amount),
                'PartyA' => (string) ($request->phoneNumber ?? ''),
                'PartyB' => $shortCode,
                'PhoneNumber' => (string) ($request->phoneNumber ?? ''),
                'CallBackURL' => $request->callbackUrl ?? rtrim((string) config('app.url'), '/').'/api/v1/webhooks/mpesa',
                'AccountReference' => $request->reference,
                'TransactionDesc' => mb_substr($request->description, 0, 13),
            ]);
        } catch (\Throwable $e) {
            Log::error('mpesa.initiate.failed', ['reference' => $request->reference, 'error' => $e->getMessage()]);

            return new PaymentInitiationResult(false, null, null, null, $e->getMessage());
        }

        $body = (array) ($response['body'] ?? []);

        if (($body['ResponseCode'] ?? '1') !== '0') {
            Log::error('mpesa.initiate.error', ['reference' => $request->reference, 'response' => $body]);

            return new PaymentInitiationResult(false, null, null, json_encode($body), (string) ($body['ResponseDescription'] ?? 'M-Pesa STK push failed.'));
        }

        return new PaymentInitiationResult(
            success: true,
            providerReference: $request->reference,
            authorizationUrl: null,
            providerResponse: json_encode($body),
            error: null,
        );
    }

    public function reconcilePayment(string $providerReference): PaymentStatus
    {
        if (! $this->isEnabled()) {
            throw new \RuntimeException('M-Pesa reconciliation is not configured.');
        }

        try {
            $response = $this->client->json('GET', $this->baseUrl().'/mpesa/transactionstatus/v1/query', [
                'Authorization' => 'Bearer '.$this->accessToken(),
                'Accept' => 'application/json',
            ], [
                'form_params' => [
                    'TransactionID' => $providerReference,
                ],
            ]);

            $body = (array) ($response['body'] ?? []);
            $resultCode = (int) ($body['ResultCode'] ?? -1);

            if ($resultCode === 0) {
                return PaymentStatus::Succeeded;
            }

            if ($resultCode === 9999 || $resultCode === -1) {
                return PaymentStatus::Pending;
            }

            return PaymentStatus::Failed;
        } catch (\Throwable $e) {
            Log::warning('mpesa.reconcile.failed', [
                'reference' => $providerReference,
                'error' => $e->getMessage(),
            ]);

            return PaymentStatus::Pending;
        }
    }
}
