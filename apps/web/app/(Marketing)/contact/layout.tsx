import type { Metadata } from 'next';
import type { PropsWithChildren } from 'react';

// page.tsx here is a client component (the contact form) — see the same
// note in pricing/layout.tsx for why metadata lives here instead.
export const metadata: Metadata = {
  title: 'Contact Us',
  description:
    'Get in touch with the PayrollFiti team about payroll, statutory compliance, or a demo for your business.',
  alternates: { canonical: '/contact' },
};

export default function ContactLayout({ children }: PropsWithChildren) {
  return children;
}
