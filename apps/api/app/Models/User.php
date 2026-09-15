<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

#[Fillable(['tenant_id', 'name', 'email', 'password', 'status'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use BelongsToTenant, HasApiTokens, HasFactory, HasRoles, HasUuids, Notifiable;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guard_name = 'web';

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'tenant_id' => 'string',
    ];

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'user_roles', 'user_id', 'role_id');
    }

    public function twoFactorAuthentication(): HasOne
    {
        return $this->hasOne(TwoFactorAuthentication::class, 'user_id');
    }

    public function userSessions(): HasMany
    {
        return $this->hasMany(UserSession::class, 'user_id');
    }

    /**
     * In-app notifications (Part 14). Named distinctly from the Notifiable
     * trait's own `notifications()` morphMany to avoid overriding it.
     */
    public function appNotifications(): HasMany
    {
        return $this->hasMany(Notification::class, 'user_id');
    }

    public function notificationPreferences(): HasMany
    {
        return $this->hasMany(NotificationPreference::class, 'user_id');
    }

    public function pushSubscriptions(): HasMany
    {
        return $this->hasMany(PushSubscription::class, 'user_id');
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }
}
