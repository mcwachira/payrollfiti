<?php

namespace App\Policies;

use App\Models\EmployeeDocument;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class EmployeeDocumentPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->tenant_id !== null && ($user->can('documents.view') || $user->can('documents.manage'));
    }

    public function view(User $user, EmployeeDocument $document): bool
    {
        return $user->tenant_id === $document->tenant_id && ($user->can('documents.view') || $user->can('documents.manage'));
    }

    public function create(User $user): bool
    {
        return $user->tenant_id !== null && ($user->can('documents.create') || $user->can('documents.manage'));
    }

    public function update(User $user, EmployeeDocument $document): bool
    {
        return $user->tenant_id === $document->tenant_id && ($user->can('documents.verify') || $user->can('documents.manage'));
    }
}
