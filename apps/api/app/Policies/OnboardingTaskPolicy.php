<?php

namespace App\Policies;

use App\Models\OnboardingTask;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class OnboardingTaskPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->tenant_id !== null && ($user->can('onboarding.view') || $user->can('onboarding.manage'));
    }

    public function view(User $user, OnboardingTask $task): bool
    {
        if ($user->tenant_id !== $task->tenant_id) {
            return false;
        }

        if ($user->can('onboarding.manage')) {
            return true;
        }

        return $task->employee->user_id === $user->id;
    }

    public function create(User $user): bool
    {
        return $user->tenant_id !== null && ($user->can('onboarding.create') || $user->can('onboarding.manage'));
    }

    public function update(User $user, OnboardingTask $task): bool
    {
        if ($user->tenant_id !== $task->tenant_id) {
            return false;
        }

        if ($user->can('onboarding.manage')) {
            return true;
        }

        return $task->employee->user_id === $user->id;
    }

    public function complete(User $user, OnboardingTask $task): bool
    {
        return $this->update($user, $task);
    }
}
