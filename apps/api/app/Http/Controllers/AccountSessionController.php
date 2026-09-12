<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\UserSession;
use Illuminate\Http\Request;

class AccountSessionController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        // Get sessions from both Laravel session (for web) and Sanctum tokens (for API)
        $sessions = $this->getUserSessions($user);

        return response()->json(['sessions' => $sessions]);
    }

    public function destroy(Request $request, string $id)
    {
        $user = $request->user();

        $session = UserSession::query()
            ->where('user_id', $user->id)
            ->findOrFail($id);

        // Prevent revoking the current session from this endpoint
        if ($this->isCurrentSession($request, $session)) {
            return response()->json(['message' => 'Current session cannot be revoked from this endpoint.'], 422);
        }

        $session->update(['revoked_at' => now()]);

        return response()->json(['message' => 'Session revoked.']);
    }

    public function destroyOthers(Request $request)
    {
        $user = $request->user();
        $currentSessionId = $this->getCurrentSessionId($request);

        UserSession::query()
            ->where('user_id', $user->id)
            ->whereNull('revoked_at')
            ->when($currentSessionId !== null, fn ($query) => $query->where('id', '!=', $currentSessionId))
            ->update(['revoked_at' => now()]);

        return response()->json(['message' => 'Other sessions revoked.']);
    }

    /**
     * Get user sessions with metadata.
     *
     * @param  User  $user
     * @return array
     */
    protected function getUserSessions($user)
    {
        return UserSession::query()
            ->where('user_id', $user->id)
            ->orderByDesc('last_active_at')
            ->get()
            ->map(function ($session) {
                $currentSessionId = $this->getCurrentSessionId(request());

                return [
                    'id' => $session->id,
                    'device' => $this->deviceLabel($session->user_agent),
                    'browser' => $this->browserLabel($session->user_agent),
                    'ip_address' => $session->ip_address,
                    'last_active_at' => $session->last_active_at?->toISOString(),
                    'current' => $session->id === $currentSessionId,
                ];
            });
    }

    /**
     * Check if a session is the current session.
     *
     * @param  UserSession  $session
     */
    protected function isCurrentSession(Request $request, $session): bool
    {
        return $this->getCurrentSessionId($request) === $session->id;
    }

    /**
     * Get the current session ID.
     *
     * @return string|null
     */
    protected function getCurrentSessionId(Request $request)
    {
        // For web requests, use Laravel session
        if ($request->session()->has('user_id')) {
            $sessionHash = hash('sha256', $request->session()->getId());
            $session = UserSession::query()
                ->where('session_hash', $sessionHash)
                ->whereNull('revoked_at')
                ->first();

            return $session ? $session->id : null;
        }

        // For API requests using Sanctum, we would need to check the token
        // For simplicity in this implementation, we'll rely on the session approach
        // In a full implementation, we'd integrate with Sanctum's token system

        return null;
    }

    protected function deviceLabel(?string $userAgent): string
    {
        if (blank($userAgent)) {
            return 'Unknown device';
        }

        if (str_contains(strtolower($userAgent), 'mobile')) {
            return 'Mobile';
        }

        if (str_contains(strtolower($userAgent), 'tablet')) {
            return 'Tablet';
        }

        return 'Desktop';
    }

    protected function browserLabel(?string $userAgent): string
    {
        if (blank($userAgent)) {
            return 'Unknown browser';
        }

        $agent = strtolower($userAgent);

        if (str_contains($agent, 'firefox')) {
            return 'Firefox';
        }

        if (str_contains($agent, 'edg')) {
            return 'Edge';
        }

        if (str_contains($agent, 'chrome')) {
            return 'Chrome';
        }

        if (str_contains($agent, 'safari')) {
            return 'Safari';
        }

        return 'Unknown browser';
    }
}
