import type { Metadata } from 'next';
import Link from 'next/link';
import { Users2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Community',
  description:
    'A space for HR and finance teams across Africa to share payroll and compliance know-how — launching soon.',
  alternates: { canonical: '/community' },
};

export default function CommunityPage() {
  return (
    <div className="py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-2xl text-center">
        <Card>
          <CardContent className="pt-10 pb-10 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-border flex items-center justify-center mb-6">
              <Users2 className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-extrabold text-foreground mb-3">
              Community Hub Launching Soon
            </h1>
            <p className="text-muted-foreground mb-8">
              We&apos;re building a space for HR and finance teams across Africa
              to share payroll and compliance know-how. Want early access when
              it launches? Subscribe from the footer below, or reach out
              directly.
            </p>
            <Button asChild>
              <Link href="/contact">Get in Touch</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
