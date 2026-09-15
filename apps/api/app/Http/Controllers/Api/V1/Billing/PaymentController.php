<?php

namespace App\Http\Controllers\Api\V1\Billing;

use App\Domain\Payments\Contracts\PaymentRequest;
use App\Domain\Payments\PaymentProviderManager;
use App\Models\Invoice;
use App\Models\PaymentTransaction;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PaymentController
{
    use AuthorizesRequests;

    public function store(\Illuminate\Http\Request $request, Invoice $invoice, PaymentProviderManager $manager): JsonResponse
    {
        $this->authorize('pay', $invoice);

        $validated = $request->validate([
            'provider' => ['required', 'string', 'in:paystack,mpesa'],
            'phone_number' => ['nullable', 'string', 'max:15'],
            'redirect_url' => ['nullable', 'url'],
        ]);

        $provider = $manager->get($validated['provider']);

        $reference = $this->buildReference($invoice);

        $existing = PaymentTransaction::query()
            ->where('idempotency_key', $reference)
            ->first();

        if ($existing !== null) {
            return $this->respondWithTransaction($existing, $existing->status === 'pending' ? 201 : 200);
        }

        $transaction = PaymentTransaction::create([
            'tenant_id' => $invoice->tenant_id,
            'invoice_id' => $invoice->id,
            'provider' => $validated['provider'],
            'idempotency_key' => $reference,
            'status' => 'pending',
            'amount' => $invoice->total,
            'currency' => $invoice->currency,
        ]);

        $result = $provider->initiate(new PaymentRequest(
            amount: (string) $invoice->total,
            currency: $invoice->currency,
            reference: $reference,
            description: "Invoice {$invoice->invoice_number}",
            callbackUrl: $validated['redirect_url'] ?? null,
            phoneNumber: $validated['phone_number'] ?? null,
        ));

        if (! $result->success) {
            $transaction->transitionTo('failed', null, [
                'initiation_error' => $result->error,
                'provider_response' => $result->providerResponse,
            ]);

            Log::warning('billing.payment.initiation_failed', [
                'invoice_id' => $invoice->id,
                'provider' => $validated['provider'],
                'error' => $result->error,
            ]);

            throw ValidationException::withMessages([
                'provider' => $result->error ?? 'Payment initiation failed.',
            ]);
        }

        $transaction->transitionTo('processing', $result->providerReference, [
            'authorization_url' => $result->authorizationUrl,
            'provider_response' => $result->providerResponse,
        ]);

        return $this->respondWithTransaction($transaction->refresh(), 201);
    }

    public function show(PaymentTransaction $paymentTransaction): JsonResponse
    {
        $this->authorize('view', $paymentTransaction);

        return $this->respondWithTransaction($paymentTransaction, 200);
    }

    private function buildReference(Invoice $invoice): string
    {
        $tenant = preg_replace('/[^a-zA-Z0-9]/', '', (string) $invoice->tenant_id);

        return 'pay_'.$tenant.'_'.Str::lower(Str::uuid());
    }

    private function respondWithTransaction(PaymentTransaction $transaction, int $status): JsonResponse
    {
        return response()->json([
            'data' => [
                'id' => $transaction->id,
                'status' => $transaction->status,
                'amount' => $transaction->amount,
                'currency' => $transaction->currency,
                'provider' => $transaction->provider,
                'authorization_url' => $transaction->provider_response['authorization_url'] ?? null,
                'completed_at' => $transaction->completed_at,
            ],
        ], $status);
    }
}
