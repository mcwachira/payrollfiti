<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Domain\Notifications\NotificationTypes;
use App\Http\Controllers\Controller;
use App\Models\NotificationPreference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Part 14 notification preferences API.
 *
 *  GET /notification-preferences   returns every known event type with the
 *                                  user's resolved channel toggles (unknown
 *                                  types a user has opted into are also shown)
 *  PUT /notification-preferences   upserts one preference object or an array
 *                                  of them:
 *                                    { "event_type": "...", "in_app": true,
 *                                      "email": true, "sms": false,
 *                                      "push": false }
 *
 * Preferences are always scoped to the authenticated user's own rows.
 */
class NotificationPreferenceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $rows = $request->user()
            ->notificationPreferences()
            ->get()
            ->keyBy('event_type');

        $preferences = [];

        foreach (NotificationTypes::all() as $eventType => $meta) {
            $preferences[] = $this->present($eventType, $meta['category'], $rows->get($eventType));
        }

        foreach ($rows as $eventType => $row) {
            if (! NotificationTypes::isKnown($eventType)) {
                $preferences[] = $this->present($eventType, NotificationTypes::category($eventType), $row);
            }
        }

        return response()->json($preferences);
    }

    public function update(Request $request): JsonResponse
    {
        $payload = $request->all();

        // Accept a single object OR a list of preference objects.
        $rows = array_is_list($payload) ? $payload : [$payload];

        if ($rows === []) {
            return response()->json(['message' => 'No preferences provided.'], 422);
        }

        $user = $request->user();

        foreach ($rows as $row) {
            $validated = validator($row, [
                'event_type' => ['required', 'string', 'max:100'],
                'in_app' => ['sometimes', 'boolean'],
                'email' => ['sometimes', 'boolean'],
                'sms' => ['sometimes', 'boolean'],
                'push' => ['sometimes', 'boolean'],
            ])->validate();

            $channels = array_intersect_key($validated, array_flip(['in_app', 'email', 'sms', 'push']));

            $preference = NotificationPreference::query()
                ->where('user_id', $user->id)
                ->where('event_type', $validated['event_type'])
                ->firstOrCreate([
                    'user_id' => $user->id,
                    'event_type' => $validated['event_type'],
                ], [
                    'tenant_id' => $user->tenant_id,
                ]);

            $preference->fill($channels)->save();
        }

        return $this->index($request);
    }

    private function present(string $eventType, string $category, ?NotificationPreference $row): array
    {
        $defaults = NotificationTypes::defaults($eventType);

        return [
            'event_type' => $eventType,
            'category' => $category,
            'channels' => [
                'in_app' => $row?->in_app ?? $defaults['in_app'],
                'email' => $row?->email ?? $defaults['email'],
                'sms' => $row?->sms ?? $defaults['sms'],
                'push' => $row?->push ?? $defaults['push'],
            ],
        ];
    }
}
