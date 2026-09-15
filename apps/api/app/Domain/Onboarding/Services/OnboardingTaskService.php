<?php

declare(strict_types=1);

namespace App\Domain\Onboarding\Services;

use App\Models\Company;
use App\Models\Employee;
use App\Models\OnboardingTask;
use App\Models\User;
use App\Support\TenantContext;
use Illuminate\Database\Eloquent\Collection;

/**
 * OnboardingTaskService — manages onboarding task lifecycle (Part 16 §16.1).
 *
 * Tasks are generated from a per-company checklist template at employee
 * creation. Each task is tracked to completion (document upload,
 * contract e-signature acknowledgment, benefits enrollment, etc.).
 *
 * An employee can only see and complete their own tasks — enforced by
 * OnboardingTaskPolicy::view() which checks $task->employee->user_id === $user->id.
 */
final class OnboardingTaskService
{
    /**
     * Generate onboarding tasks for a newly hired employee
     * from the company's checklist template.
     *
     * @param  array<string>  $taskTitles
     * @return array<OnboardingTask>
     */
    public function generateForEmployee(Employee $employee, Company $company, array $taskTitles = []): array
    {
        $tenantId = TenantContext::current();
        $tasks = [];

        $defaultTasks = $taskTitles ?: $this->getDefaultTaskTitles();

        foreach ($defaultTasks as $title) {
            $task = OnboardingTask::create([
                'tenant_id' => $tenantId,
                'company_id' => $company->id,
                'employee_id' => $employee->id,
                'title' => $title,
                'description' => $this->getTaskDescription($title),
                'status' => 'pending',
            ]);

            $tasks[] = $task;
        }

        return $tasks;
    }

    public function completeTask(OnboardingTask $task, User $actor): void
    {
        $task->update([
            'status' => 'completed',
            'completed_at' => now(),
        ]);
    }

    public function markPending(OnboardingTask $task): void
    {
        $task->update([
            'status' => 'pending',
            'completed_at' => null,
        ]);
    }

    public function getEmployeeTasks(string $employeeId, ?string $status = null): Collection
    {
        $tenantId = TenantContext::current();

        $query = OnboardingTask::query()
            ->where('tenant_id', $tenantId)
            ->where('employee_id', $employeeId);

        if ($status) {
            $query->where('status', $status);
        }

        return $query->latest()->get();
    }

    public function getTaskProgress(string $employeeId): array
    {
        $tasks = $this->getEmployeeTasks($employeeId);
        $total = $tasks->count();
        $completed = $tasks->where('status', 'completed')->count();

        return [
            'total' => $total,
            'completed' => $completed,
            'pending' => $total - $completed,
            'percentage' => $total > 0 ? (int) round(($completed / $total) * 100) : 0,
        ];
    }

    /**
     * Get the default checklist of onboarding tasks.
     *
     * @return array<string>
     */
    private function getDefaultTaskTitles(): array
    {
        return [
            'Upload identification document',
            'Review and sign employment contract',
            'Complete benefits enrollment',
            'Set up payroll bank details',
            'Review company policies',
            'Complete tax documentation',
        ];
    }

    /**
     * Get a human-readable description for a task title.
     */
    private function getTaskDescription(string $title): string
    {
        return match ($title) {
            'Upload identification document' => 'Please upload a valid government-issued ID for verification.',
            'Review and sign employment contract' => 'Review your employment contract and e-sign to confirm acceptance.',
            'Complete benefits enrollment' => 'Select your preferred benefits package during the enrollment period.',
            'Set up payroll bank details' => 'Provide your bank account details for payroll processing.',
            'Review company policies' => 'Read and acknowledge the company handbook and policies.',
            'Complete tax documentation' => 'Fill out the required tax forms for your jurisdiction.',
            default => 'Complete this onboarding task.',
        };
    }
}
