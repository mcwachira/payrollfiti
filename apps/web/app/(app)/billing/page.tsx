'use client';
import React, { useEffect, useState } from 'react';
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

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function invoiceStatusColor(status: Invoice['status']) {
  switch (status) {
    case 'PAID':
      return 'bg-green-100 text-green-800';
    case 'OPEN':
      return 'bg-blue-100 text-blue-800';
    case 'VOID':
    case 'UNCOLLECTIBLE':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function BillingPageContent() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscribingCode, setSubscribingCode] = useState<string | null>(null);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isPaying, setIsPaying] = useState(false);

  const reload = async () => {
    const [subs, invs] = await Promise.all([getSubscription(), listInvoices()]);
    setSubscription(subs);
    setInvoices(invs);
  };

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const [planList, subs, invs] = await Promise.all([
          listPlans(),
          getSubscription(),
          listInvoices(),
        ]);
        if (cancelled) return;
        setPlans(planList);
        setSubscription(subs);
        setInvoices(invs);
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof ApiError
              ? err.message
              : 'Failed to load billing data',
          );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubscribe = async (planCode: string) => {
    setSubscribingCode(planCode);
    try {
      await subscribe({ planCode });
      toast.success('Subscribed successfully');
      await reload();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : 'Failed to subscribe',
      );
    } finally {
      setSubscribingCode(null);
    }
  };

  const handlePayInvoice = async () => {
    if (!payingInvoice) return;
    setIsPaying(true);
    try {
      await payInvoice(payingInvoice.id, phoneNumber ? { phoneNumber } : {});
      toast.success('Payment submitted');
      setPayingInvoice(null);
      setPhoneNumber('');
      await reload();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : 'Failed to pay invoice',
      );
    } finally {
      setIsPaying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-red-600">Error loading billing data: {error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
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
                    <p className="text-2xl font-bold">
                      {formatCurrency(plan.pricePerEmployee, plan.currency)}
                      <span className="text-sm font-normal text-muted-foreground">
                        {' '}
                        / employee / mo
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
                      <Badge className={invoiceStatusColor(invoice.status)}>
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
                disabled={isPaying}
                className="w-full"
              >
                {isPaying ? 'Processing…' : 'Pay Now'}
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
