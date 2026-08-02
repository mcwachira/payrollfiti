'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { listLeaveTypes, createLeaveRequest } from '@/lib/leave-api';
import { ApiError } from '@/lib/api-client';

interface LeaveApplicationProps {
  employeeId: string;
}

export default function LeaveApplication({
  employeeId,
}: LeaveApplicationProps) {
  const queryClient = useQueryClient();
  const typesQuery = useQuery({
    queryKey: ['leave-types'],
    queryFn: listLeaveTypes,
  });

  const [formData, setFormData] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
  });

  const calculateDays = (startDate: string, endDate: string): number => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const submitMutation = useMutation({
    mutationFn: () =>
      createLeaveRequest({
        leaveTypeId: formData.leave_type_id,
        startDate: formData.start_date,
        endDate: formData.end_date,
        reason: formData.reason || undefined,
        // employeeId is deliberately omitted — the backend infers "your own"
        // from the JWT for an EMPLOYEE caller and rejects any mismatched id
        // passed here, so there's nothing this form needs to supply.
      }),
    onSuccess: () => {
      toast.success('Leave application submitted — pending approval');
      setFormData({
        leave_type_id: '',
        start_date: '',
        end_date: '',
        reason: '',
      });
      // Refreshes both the balance card (used days can change once approved,
      // but the request itself should show up immediately) and the My
      // Applications tab, which read the same underlying data.
      queryClient.invalidateQueries({
        queryKey: ['leave-balances', employeeId],
      });
      queryClient.invalidateQueries({ queryKey: ['leave-requests', 'mine'] });
    },
    onError: (error) => {
      toast.error('Could not submit your leave application', {
        description:
          error instanceof ApiError
            ? error.message
            : 'Please check the details and try again',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitMutation.mutate();
  };

  const days = calculateDays(formData.start_date, formData.end_date);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Apply for Leave
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="leave_type">Leave Type</Label>
            <Select
              value={formData.leave_type_id}
              onValueChange={(value) =>
                setFormData({ ...formData, leave_type_id: value })
              }
            >
              <SelectTrigger id="leave_type">
                <SelectValue
                  placeholder={
                    typesQuery.isPending ? 'Loading…' : 'Select leave type'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {(typesQuery.data ?? []).map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name} {type.isPaid ? '' : '(unpaid)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                type="date"
                id="start_date"
                value={formData.start_date}
                onChange={(e) =>
                  setFormData({ ...formData, start_date: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label htmlFor="end_date">End Date</Label>
              <Input
                type="date"
                id="end_date"
                value={formData.end_date}
                min={formData.start_date || undefined}
                onChange={(e) =>
                  setFormData({ ...formData, end_date: e.target.value })
                }
                required
              />
            </div>
          </div>

          {days > 0 && (
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {days} calendar day{days === 1 ? '' : 's'} requested — public
              holidays are excluded automatically when this is submitted.
            </div>
          )}

          <div>
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              placeholder="Enter reason for leave..."
              value={formData.reason}
              onChange={(e) =>
                setFormData({ ...formData, reason: e.target.value })
              }
              rows={3}
            />
          </div>

          <Button
            type="submit"
            disabled={
              submitMutation.isPending ||
              !formData.leave_type_id ||
              !formData.start_date ||
              !formData.end_date
            }
          >
            {submitMutation.isPending ? 'Submitting...' : 'Submit Application'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
