'use client';
import React, { useState, useEffect } from 'react';
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

interface LeaveApplicationProps {
  employeeId: string;
}

interface LeaveType {
  id: string;
  name: string;
  type: string;
}

const mockLeaveTypes: LeaveType[] = [
  {
    id: 'lt-1',
    name: 'Annual Leave',
    type: 'Paid',
  },
  {
    id: 'lt-2',
    name: 'Sick Leave',
    type: 'Paid',
  },
  {
    id: 'lt-3',
    name: 'Maternity Leave',
    type: 'Paid',
  },
  {
    id: 'lt-4',
    name: 'Unpaid Leave',
    type: 'Unpaid',
  },
];

export default function LeaveApplication({
  employeeId,
}: LeaveApplicationProps) {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [formData, setFormData] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

  const fetchLeaveTypes = async () => {
    try {
      // Simulate network delay
      await new Promise((res) => setTimeout(res, 500));
      setLeaveTypes(mockLeaveTypes);
    } catch (error: any) {
      console.error('Error fetching leave types:', error);
      toast({
        title: 'Error',
        description: 'Failed to load leave types',
        variant: 'destructive',
      });
    }
  };

  const calculateDays = (startDate: string, endDate: string): number => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const daysRequested = calculateDays(
        formData.start_date,
        formData.end_date,
      );

      // Simulate submission delay
      await new Promise((res) => setTimeout(res, 1000));

      console.log('Mock Submission:', {
        employee_id: employeeId,
        ...formData,
        days_requested: daysRequested,
        status: 'pending',
      });

      toast('Leave application submitted successfully');

      setFormData({
        leave_type_id: '',
        start_date: '',
        end_date: '',
        reason: '',
      });
    } catch (error: any) {
      console.error('Error submitting leave application:', error);
      toast('Failed to submit leave application');
    } finally {
      setIsSubmitting(false);
    }
  };

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
              <SelectTrigger>
                <SelectValue placeholder="Select leave type" />
              </SelectTrigger>
              <SelectContent>
                {leaveTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
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
                onChange={(e) =>
                  setFormData({ ...formData, end_date: e.target.value })
                }
                required
              />
            </div>
          </div>

          {formData.start_date && formData.end_date && (
            <div className="text-sm text-muted-foreground">
              Total days:{' '}
              {calculateDays(formData.start_date, formData.end_date)}
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

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Application'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
