'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Check, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const tiers = [
  {
    name: 'Starter',
    price: 'KES 2,500',
    period: '/month',
    description: 'For small teams getting started with compliant payroll.',
    features: [
      'Up to 10 employees',
      'PAYE, NSSF & NHIF automation',
      'Payslip generation',
      'Employee self-service portal',
      'Email support',
    ],
  },
  {
    name: 'Growth',
    price: 'KES 6,500',
    period: '/month',
    description: 'For growing businesses that need more automation.',
    features: [
      'Up to 100 employees',
      'Everything in Starter',
      'Leave management',
      'Payroll analytics dashboard',
      'Bank export & remittance files',
      'Priority support',
    ],
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For multi-country operations with custom needs.',
    features: [
      'Unlimited employees',
      'Everything in Growth',
      'Multi-country support',
      'Dedicated account manager',
      'Custom API integrations',
      'SLA-backed uptime',
    ],
  },
];

// Mirrors packages/payroll-rules/src/countries/kenya/constants.ts (KE-2024.1)
const PAYE_BRACKETS = [
  { min: 0, max: 24_000, rate: 0.1 },
  { min: 24_000, max: 32_333, rate: 0.25 },
  { min: 32_333, max: 500_000, rate: 0.3 },
  { min: 500_000, max: 800_000, rate: 0.325 },
  { min: 800_000, max: Infinity, rate: 0.35 },
];
const PERSONAL_RELIEF = 2_400;

function estimatePaye(grossMonthly: number) {
  let tax = 0;
  for (const bracket of PAYE_BRACKETS) {
    if (grossMonthly <= bracket.min) break;
    const upper = Math.min(grossMonthly, bracket.max);
    tax += (upper - bracket.min) * bracket.rate;
  }
  return Math.max(0, tax - PERSONAL_RELIEF);
}

function formatKes(amount: number) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function PricingPage() {
  const [gross, setGross] = useState('80000');
  const grossValue = Number(gross) || 0;
  const paye = estimatePaye(grossValue);
  const net = grossValue - paye;

  return (
    <div className="py-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Choose the plan that fits your team. No setup fees, cancel anytime.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-24 items-start">
          {tiers.map((tier) => (
            <Card
              key={tier.name}
              className={
                tier.highlighted ? 'bg-primary text-primary-foreground' : ''
              }
            >
              <CardHeader>
                {tier.highlighted && (
                  <Badge className="w-fit mb-2 bg-white text-primary">
                    Most Popular
                  </Badge>
                )}
                <CardTitle className="text-2xl">{tier.name}</CardTitle>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-extrabold">{tier.price}</span>
                  <span
                    className={
                      tier.highlighted
                        ? 'text-primary-foreground/80'
                        : 'text-muted-foreground'
                    }
                  >
                    {tier.period}
                  </span>
                </div>
                <p
                  className={
                    tier.highlighted
                      ? 'text-primary-foreground/90 text-sm mt-2'
                      : 'text-muted-foreground text-sm mt-2'
                  }
                >
                  {tier.description}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {tier.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm"
                    >
                      <Check className="h-4 w-4 mt-0.5 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  className={
                    tier.highlighted
                      ? 'w-full bg-white text-primary hover:bg-white'
                      : 'w-full'
                  }
                  variant={tier.highlighted ? undefined : 'outline'}
                >
                  <Link
                    href={tier.name === 'Enterprise' ? '/contact' : '/signup'}
                  >
                    {tier.name === 'Enterprise'
                      ? 'Talk to Sales'
                      : 'Get Started'}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* PAYE Compliance Calculator */}
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                <CardTitle>Kenya PAYE Compliance Calculator</CardTitle>
              </div>
              <p className="text-muted-foreground text-sm">
                Estimate monthly PAYE using current KRA brackets (rule set
                KE-2024.1). For illustration only — actual payroll runs also
                account for NSSF/NHIF/housing levy relief.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gross">Gross Monthly Salary (KES)</Label>
                <Input
                  id="gross"
                  type="number"
                  min="0"
                  value={gross}
                  onChange={(e) => setGross(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-md border-2 border-border p-4">
                  <div className="text-sm text-muted-foreground">
                    Estimated PAYE
                  </div>
                  <div className="text-2xl font-extrabold text-destructive">
                    {formatKes(paye)}
                  </div>
                </div>
                <div className="rounded-md border-2 border-border p-4">
                  <div className="text-sm text-muted-foreground">
                    Net Pay (before NSSF/NHIF)
                  </div>
                  <div className="text-2xl font-extrabold text-green-600 dark:text-green-400">
                    {formatKes(net)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
