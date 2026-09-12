<?php

namespace App\Domain\Payments\Contracts;

use App\Domain\Payments\Exceptions\WebhookVerificationException;
use Illuminate\Http\Request;

interface PaymentProvider
{
    public function name(): string;

    /**
     * @throws WebhookVerificationException
     */
    public function verifyWebhookSignature(Request $request): true;

    public function parseWebhook(Request $request): WebhookEvent;

    public function initiate(PaymentRequest $request): PaymentInitiationResult;

    public function reconcilePayment(string $providerReference): PaymentStatus;
}
