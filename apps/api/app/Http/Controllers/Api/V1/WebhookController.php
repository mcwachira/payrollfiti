<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Payments\Contracts\PaymentProvider;
use App\Domain\Payments\PaymentProviderManager;
use App\Jobs\ProcessPaymentWebhook;
use App\Models\PaymentProviderEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class WebhookController
{
    public function handle(Request $request, string $provider): JsonResponse
    {
        $manager = app(PaymentProviderManager::class);

        if (! $manager->has($provider)) {
            return response()->json(['error' => 'Unknown payment provider.'], 404);
        }

        /** @var PaymentProvider $providerInstance */
        $providerInstance = $manager->get($provider);

        try {
            $providerInstance->verifyWebhookSignature($request);
        } catch (\Throwable $e) {
            Log::warning('webhook.verification_failed', ['provider' => $provider, 'error' => $e->getMessage()]);

            return response()->json(['error' => 'Webhook verification failed.'], 400);
        }

        $event = $providerInstance->parseWebhook($request);

        $inboundEvent = PaymentProviderEvent::withoutTenantScope()
            ->firstOrCreate(
                [
                    'provider' => $provider,
                    'provider_event_id' => $event->providerEventId,
                ],
                [
                    'tenant_id' => null,
                    'event_type' => $event->eventType,
                    'payload' => $event->rawPayload,
                    'status' => 'received',
                ],
            );

        if ($inboundEvent->wasRecentlyCreated || $inboundEvent->status === 'received') {
            ProcessPaymentWebhook::dispatch($inboundEvent->id)->onQueue('webhooks');
        }

        return response()->json(['status' => 'accepted'], JsonResponse::HTTP_ACCEPTED);
    }
}
