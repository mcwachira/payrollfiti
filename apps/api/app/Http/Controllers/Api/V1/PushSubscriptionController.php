<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PushSubscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Web Push subscription API (backend-authoritative; mirrors the browser
 * PushSubscriptionJSON shape so the frontend can POST / DELETE as-is).
 *
 *  GET    /push-subscriptions/vapid-public-key → { "publicKey": string|null }
 *  POST   /push-subscriptions   { endpoint, keys:{ p256dh, auth }, userAgent }
 *  DELETE /push-subscriptions   { endpoint }
 *
 * Endpoints are unique per user; re-subscribing the same browser upserts.
 * VAPID keys themselves live server-side and are never exposed here.
 */
class PushSubscriptionController extends Controller
{
    public function vapidPublicKey(): JsonResponse
    {
        return response()->json([
            'publicKey' => config('services.vapid.public_key'),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'endpoint' => ['required', 'string', 'max:2048'],
            'keys' => ['sometimes', 'array'],
            'keys.p256dh' => ['required_with:keys', 'string', 'max:512'],
            'keys.auth' => ['required_with:keys', 'string', 'max:512'],
            'userAgent' => ['nullable', 'string', 'max:512'],
        ]);

        $user = $request->user();

        PushSubscription::query()
            ->where('user_id', $user->id)
            ->where('endpoint', $validated['endpoint'])
            ->firstOr(function () use ($user, $validated) {
                return $user->pushSubscriptions()->create([
                    'tenant_id' => $user->tenant_id,
                    'user_id' => $user->id,
                    'endpoint' => $validated['endpoint'],
                ]);
            })
            ->forceFill([
                'public_key' => $validated['keys']['p256dh'] ?? null,
                'auth_token' => $validated['keys']['auth'] ?? null,
                'last_used_at' => now(),
            ])
            ->save();

        return response()->json(null, 204);
    }

    public function destroy(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'endpoint' => ['required', 'string', 'max:2048'],
        ]);

        $request->user()
            ->pushSubscriptions()
            ->where('endpoint', $validated['endpoint'])
            ->delete();

        return response()->json(null, 204);
    }
}
