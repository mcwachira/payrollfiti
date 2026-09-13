'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

import {
  listOnboardingTasks,
  updateOnboardingTask,
  type OnboardingTask,
  type TaskProgress,
} from '@/lib/onboarding-api';
import { ApiError } from '@/lib/api-client';

export function OnboardingTaskList({ employeeId }: { employeeId: string }) {
  const queryClient = useQueryClient();

  const { data: tasks, isLoading, error } = useQuery<OnboardingTask[]>({
    queryKey: ['onboarding-tasks', employeeId],
    queryFn: () => listOnboardingTasks(employeeId),
  });

  const { data: progress } = useQuery<TaskProgress>({
    queryKey: ['onboarding-progress', employeeId],
    queryFn: () =>
      listOnboardingTasks(employeeId).then((ts) => ({
        total: ts.length,
        completed: ts.filter((t) => t.status === 'completed').length,
        pending: ts.filter((t) => t.status === 'pending').length,
        percentage: ts.length > 0 ? Math.round((ts.filter((t) => t.status === 'completed').length / ts.length) * 100) : 0,
      })),
    enabled: !!employeeId,
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => updateOnboardingTask(id, 'completed'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-tasks', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-progress', employeeId] });
      toast.success('Task completed');
    },
    onError: (error: unknown) => {
      const message = error instanceof ApiError ? error.message : 'Failed to complete task';
      toast.error(message);
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (error) {
    return <Card><CardContent className="p-4"><p className="text-sm text-red-600">Failed to load tasks</p></CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      {progress && (
        <Card>
          <CardHeader>
            <CardTitle>Onboarding Progress</CardTitle>
            <CardDescription>
              {progress.completed} of {progress.total} tasks completed ({progress.percentage}%)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={progress.percentage} className="w-full" />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
          <CardDescription>Complete each task to finish onboarding</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {tasks?.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={task.status === 'completed' ? 'line-through text-muted-foreground' : ''}>
                    {task.title}
                  </span>
                  <Badge variant={task.status === 'completed' ? 'default' : 'neutral'}>
                    {task.status}
                  </Badge>
                </div>
                {task.description && (
                  <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                )}
              </div>
              {task.status === 'pending' && (
                <Button
                  variant="neutral"
                  size="sm"
                  onClick={() => completeMutation.mutate(task.id)}
                  disabled={completeMutation.isPending}
                >
                  {completeMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
              )}
              {task.status === 'completed' && (
                <Check className="h-5 w-5 text-green-600" />
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
