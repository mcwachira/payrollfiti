<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\NotificationResource;
use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Part 14 Notification Centre API (backend-authoritative).
 *
 *  GET  /notifications                 list own notifications (unreadOnly=true filters)
 *  GET  /notifications/{notification}  single
 *  POST /notifications/{notification}/read   mark read (idempotent)
 *  POST /notifications/read-all        mark every own notification read
 *
 * Route model bindings are user-scoped (see AppServiceProvider) so any
 * notification that is not THIS user's resolves to 404.
 */
class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $limit = max(1, min((int) $request->query('take', config('notifications.list_limit', 50)), 100));

        $query = Notification::query()
            ->where('user_id', $request->user()->id)
            ->orderByDesc('created_at');

        if ($request->boolean('unreadOnly')) {
            $query->unread();
        }

        $notifications = $query->limit($limit)->get();

        return response()->json(
            NotificationResource::collection($notifications)->resolve(),
        );
    }

    public function show(Request $request, Notification $notification): JsonResponse
    {
        $this->authorize('view', $notification);

        return (new NotificationResource($notification))->response();
    }

    public function markRead(Request $request, Notification $notification): JsonResponse
    {
        $this->authorize('update', $notification);

        if ($notification->read_at === null) {
            $notification->update(['read_at' => now()]);
        }

        return (new NotificationResource($notification->refresh()))->response();
    }

    public function markAllRead(Request $request): JsonResponse
    {
        Notification::query()
            ->where('user_id', $request->user()->id)
            ->unread()
            ->update(['read_at' => now()]);

        return response()->json(['message' => 'All notifications marked as read.']);
    }
}
