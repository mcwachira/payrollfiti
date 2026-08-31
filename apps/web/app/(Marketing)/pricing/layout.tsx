import type { Metadata } from 'next';
import type { PropsWithChildren } from 'react';

// page.tsx here is a client component (the interactive calculator), which
// can't export `metadata` itself — a co-located layout.tsx is the standard
// App Router workaround, since layouts can stay server components even
// when their page is a client component.
export const metadata: Metadata = {
  title: 'Pricing & Free Payroll Calculator',
  description:
    'Simple, transparent pricing plus a live PAYE, NSSF, SHIF, and statutory deduction calculator for Kenya, Nigeria, and South Africa — no signup required.',
  alternates: { canonical: '/pricing' },
};

export default function PricingLayout({ children }: PropsWithChildren) {
  return children;
}
