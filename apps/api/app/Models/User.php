<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use BelongsToTenant;
    use HasApiTokens;
    use HasFactory;
    use HasRoles;
    use HasUuids;
    use Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'status',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
    ];

    public $incrementing = false;

    protected $keyType = 'string';

    public function twoFactorAuthentication(): HasOne
    {
        return $this->hasOne(
            TwoFactorAuthentication::class,
            'user_id'
        );
    }

    public function userSessions(): HasMany
    {
        return $this->hasMany(
            UserSession::class,
            'user_id'
        );
    }

    public function appNotifications(): HasMany
    {
        return $this->hasMany(
            Notification::class,
            'user_id'
        );
    }

    public function notificationPreferences(): HasMany
    {
        return $this->hasMany(
            NotificationPreference::class,
            'user_id'
        );
    }

    public function pushSubscriptions(): HasMany
    {
        return $this->hasMany(
            PushSubscription::class,
            'user_id'
        );
    }
}
