import { apiFetch } from './api-client';

export interface Plan {
  id: string;
  code: string;
  name: string;
  pricePerEmployee: number;
  currency: string;
  tier: string | null;
  isActive: boolean;
}

export interface Subscription {
  id: string;
  tenantId: string;
  planId: string;
  plan: Plan;
  status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
  provider: 'STRIPE' | 'MPESA';
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

export interface Invoice {
  id: string;
  tenantId: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  status: 'DRAFT' | 'OPEN' | 'PAID' | 'VOID' | 'UNCOLLECTIBLE';
  dueDate: string;
  paidAt: string | null;
  provider: 'STRIPE' | 'MPESA';
  createdAt: string;
}

export interface SubscribeInput {
  planCode: string;
  provider?: 'STRIPE' | 'MPESA';
}

export interface PayInvoiceInput {
  phoneNumber?: string;
}

export function listPlans(): Promise<Plan[]> {
  return apiFetch<Plan[]>('/billing/plans');
}

export function getSubscription(): Promise<Subscription | null> {
  return apiFetch<Subscription | null>('/billing/subscription');
}

export function subscribe(input: SubscribeInput): Promise<Subscription> {
  return apiFetch<Subscription>('/billing/subscribe', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listInvoices(): Promise<Invoice[]> {
  return apiFetch<Invoice[]>('/billing/invoices');
}

export function payInvoice(
  id: string,
  input: PayInvoiceInput = {},
): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(`/billing/invoices/${id}/pay`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
