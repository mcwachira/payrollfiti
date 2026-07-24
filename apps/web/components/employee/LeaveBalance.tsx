'use client';
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface LeaveBalanceProps {
  employeeId: string;
}

interface LeaveBalance {
  id: string;
  leave_type_id: string;
  year: number;
  opening_balance: number;
  earned_balance: number;
  used_balance: number;
  closing_balance: number;
  leave_types: {
    name: string;
    type: string;
  };
}
const mockLeaveBalances: LeaveBalance[] = [
  {
    id: '1',
    leave_type_id: 'annual',
    year: 2025,
    opening_balance: 21,
    earned_balance: 7,
    used_balance: 5,
    closing_balance: 23,
    leave_types: {
      name: 'Annual Leave',
      type: 'Paid',
    },
  },
  {
    id: '2',
    leave_type_id: 'sick',
    year: 2025,
    opening_balance: 10,
    earned_balance: 5,
    used_balance: 3,
    closing_balance: 12,
    leave_types: {
      name: 'Sick Leave',
      type: 'Paid',
    },
  },
  {
    id: '3',
    leave_type_id: 'unpaid',
    year: 2025,
    opening_balance: 0,
    earned_balance: 0,
    used_balance: 2,
    closing_balance: -2,
    leave_types: {
      name: 'Unpaid Leave',
      type: 'Unpaid',
    },
  },
];

export default function LeaveBalance({ employeeId }: LeaveBalanceProps) {
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLeaveBalances();
  }, [employeeId]);

  const fetchLeaveBalances = async () => {
    try {
      setIsLoading(true);
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const filtered = mockLeaveBalances.filter(
        (b) => b.year === new Date().getFullYear(),
      );

      setBalances(filtered);
    } catch (error: any) {
      console.error('Error fetching leave balances:', error);
      toast.error('Failed to load leave balances');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return <div>Loading leave balances...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Leave Balances
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {balances.length === 0 ? (
            <p className="text-muted-foreground">No leave balances found</p>
          ) : (
            balances.map((balance) => (
              <div
                key={balance.id}
                className="flex justify-between items-center p-3 border rounded-lg"
              >
                <div>
                  <h4 className="font-medium">{balance.leave_types?.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    Used: {balance.used_balance} days
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant="secondary">
                    {balance.closing_balance} days remaining
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
