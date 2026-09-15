'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CreditCard, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { Role } from '@repo/api';
import { RoleGuard } from '@/components/RoleGuard';
import {
  listPlans,
  getSubscription,
  subscribe,
  listInvoices,
  payInvoice,
  type Plan,
  type Subscription,
  type Invoice,
} from '@/lib/billing-api';
import { ApiError } from '@/lib/api-client';
import { getInvoiceStatusColor } from '@/lib/status-styles';
import { PageSkeleton } from '@/components/ui/loading-skeleton';

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function BillingPageContent() {
  const queryClient = useQueryClient();
  const [subscribingCode, setSubscribingCode] = useState<string | null>(null);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');

  const plansQuery = useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: listPlans,
  });

  const subscriptionQuery = useQuery({
    queryKey: ['billing', 'subscription'],
    queryFn: getSubscription,
  });

  const invoicesQuery = useQuery({
    queryKey: ['billing', 'invoices'],
    queryFn: listInvoices,
  });

  const subscribeMutation = useMutation({
    mutationFn: ({ planCode }: { planCode: string }) => subscribe({ planCode }),
    onSuccess: () => {
      toast.success('Subscribed successfully');
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError ? error.message : 'Failed to subscribe',
      );
    },
  });

  const payInvoiceMutation = useMutation({
    mutationFn: ({ invoice, phoneNumber }: { invoice: Invoice; phoneNumber?: string }) =>
      payInvoice(invoice.id, phoneNumber ? { phoneNumber } : {}),
    onSuccess: () => {
      toast.success('Payment submitted');
      setPayingInvoice(null);
      setPhoneNumber('');
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError ? error.message : 'Failed to pay invoice',
      );
    },
  });

  const isLoading = plansQuery.isPending || subscriptionQuery.isPending || invoicesQuery.isPending;
  const error = plansQuery.error ?? subscriptionQuery.error ?? invoicesQuery.error;
  const plans = plansQuery.data ?? [];
  const subscription = subscriptionQuery.data ?? null;
  const invoices = invoicesQuery.data ?? [];

  const handleSubscribe = (planCode: string) => {
    setSubscribingCode(planCode);
    subscribeMutation.mutate(
      { planCode },
      {
        onSettled: () => setSubscribingCode(null),
      },
    );
  };

  const handlePayInvoice = () => {
    if (!payingInvoice) return;
    payInvoiceMutation.mutate({ invoice: payingInvoice, phoneNumber: phoneNumber || undefined });
  };

  if (isLoading) {
    return <PageSkeleton cards={3} rows={4} />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-red-600 dark:text-red-400">
            Error loading billing data: {error instanceof Error ? error.message : 'Failed to load billing data'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Billing</h1>
        <p className="text-muted-foreground">
          Manage your subscription plan and invoices
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
        </CardHeader>
        <CardContent>
          {subscription ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold">
                  {subscription.plan.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(
                    subscription.plan.pricePerEmployee,
                    subscription.plan.currency,
                  )}{' '}
                  / employee / month
                </p>
              </div>
              <Badge
                className={
                  subscription.status === 'ACTIVE'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }
              >
                {subscription.status}
              </Badge>
            </div>
          ) : (
            <div className="text-center py-6">
              <CreditCard className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">
                No active subscription yet. Choose a plan below to get started.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
        </CardHeader>
        <CardContent>
          {plans.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center">
              No plans available.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map((plan) => (
                <Card
                  key={plan.id}
                  className={
                    subscription?.planId === plan.id ? 'border-primary' : ''
                  }
                >
                  <CardHeader>
                    <CardTitle className="text-base">{plan.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-2xl font-extrabold">
                      {formatCurrency(plan.pricePerEmployee, plan.currency)}
                      <span className="text-sm font-normal text-muted-foreground">
                        {' '}/ employee / mo
                      </span>
                    </p>
                    <Button
                      className="w-full"
                      variant={
                        subscription?.planId === plan.id ? 'outline' : 'default'
                      }
                      disabled={subscribingCode === plan.code}
                      onClick={() => handleSubscribe(plan.code)}
                    >
                      {subscription?.planId === plan.id
                        ? 'Current Plan'
                        : subscribingCode === plan.code
                          ? 'Subscribing…'
                          : 'Subscribe'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              <Receipt className="h-8 w-8 mx-auto mb-2" />
              No invoices yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      {new Date(invoice.dueDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(invoice.amount, invoice.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge className={getInvoiceStatusColor(invoice.status)}>
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {invoice.status === 'OPEN' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPayingInvoice(invoice)}
                        >
                          Pay
                        </Button>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!payingInvoice}
        onOpenChange={(open) => !open && setPayingInvoice(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pay Invoice</DialogTitle>
          </DialogHeader>
          {payingInvoice && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Amount due:{' '}
                {formatCurrency(payingInvoice.amount, payingInvoice.currency)}
              </p>
              {payingInvoice.provider === 'MPESA' && (
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">M-Pesa Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="254700000000"
                  />
                </div>
              )}
              <Button
                onClick={handlePayInvoice}
                disabled={payInvoiceMutation.isPending}
                className="w-full"
              >
                {payInvoiceMutation.isPending ? 'Processing…' : 'Pay Now'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function BillingPage() {
  return (
    <RoleGuard allow={[Role.ADMIN]}>
      <BillingPageContent />
    </RoleGuard>
  );
}
