'use client';
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CheckCircle2, Plus } from 'lucide-react';
import {
  listOnboardingTasks,
  addOnboardingTask,
  updateOnboardingTask,
  completeOnboarding,
} from '@/lib/employees-api';
import { ApiError } from '@/lib/api-client';

interface EmployeeOnboardingDialogProps {
  employeeId: string;
  employeeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOnboardingCompleted: () => void;
}

export function EmployeeOnboardingDialog({
  employeeId,
  employeeName,
  open,
  onOpenChange,
  onOnboardingCompleted,
}: EmployeeOnboardingDialogProps) {
  const queryClient = useQueryClient();
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const tasksQuery = useQuery({
    queryKey: ['onboarding-tasks', employeeId],
    queryFn: () => listOnboardingTasks(employeeId),
    enabled: open,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ taskId, completed }: { taskId: string; completed: boolean }) =>
      updateOnboardingTask(employeeId, taskId, completed),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['onboarding-tasks', employeeId],
      }),
    onError: (error) =>
      toast.error(
        error instanceof ApiError ? error.message : 'Failed to update task',
      ),
  });

  const addTaskMutation = useMutation({
    mutationFn: () => addOnboardingTask(employeeId, { title: newTaskTitle }),
    onSuccess: () => {
      setNewTaskTitle('');
      queryClient.invalidateQueries({
        queryKey: ['onboarding-tasks', employeeId],
      });
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError ? error.message : 'Failed to add task',
      ),
  });

  const completeMutation = useMutation({
    mutationFn: () => completeOnboarding(employeeId),
    onSuccess: () => {
      toast.success(`${employeeName} is now active`);
      onOnboardingCompleted();
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error('Could not complete onboarding', {
        description:
          error instanceof ApiError
            ? error.message
            : 'Required tasks may still be incomplete',
      }),
  });

  const tasks = tasksQuery.data ?? [];
  const requiredIncomplete = tasks.filter(
    (t) => t.isRequired && !t.completed,
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Onboarding — {employeeName}</DialogTitle>
          <DialogDescription>
            Complete the checklist below, then mark onboarding complete to
            activate this employee for payroll and billing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {tasksQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading tasks…</p>
          ) : (
            tasks.map((task) => (
              <label
                key={task.id}
                className="flex items-start gap-3 rounded-md border p-3 text-sm"
              >
                <Checkbox
                  checked={task.completed}
                  disabled={toggleMutation.isPending}
                  onCheckedChange={(checked) =>
                    toggleMutation.mutate({
                      taskId: task.id,
                      completed: checked === true,
                    })
                  }
                />
                <span
                  className={
                    task.completed ? 'line-through text-muted-foreground' : ''
                  }
                >
                  {task.title}
                  {task.isRequired && (
                    <span className="ml-1 text-xs text-red-500">*</span>
                  )}
                </span>
              </label>
            ))
          )}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Add a custom task"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
          />
          <Button
            variant="outline"
            disabled={!newTaskTitle.trim() || addTaskMutation.isPending}
            onClick={() => addTaskMutation.mutate()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            {requiredIncomplete > 0
              ? `${requiredIncomplete} required task(s) remaining`
              : 'All required tasks complete'}
          </p>
          <Button
            disabled={requiredIncomplete > 0 || completeMutation.isPending}
            onClick={() => completeMutation.mutate()}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Complete Onboarding
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
