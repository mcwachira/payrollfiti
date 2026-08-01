import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const components = [
  { name: 'Web Application', status: 'Operational' },
  { name: 'Payroll API', status: 'Operational' },
  { name: 'Employee Portal', status: 'Operational' },
  { name: 'Payments (Stripe & M-Pesa)', status: 'Operational' },
  { name: 'Email Notifications', status: 'Operational' },
];

export default function StatusPage() {
  return (
    <div className="py-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-2xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border-2 border-border bg-green-100 dark:bg-green-900/30 px-4 py-2 mb-4">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            <span className="font-bold text-green-800 dark:text-green-400">
              All Systems Operational
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mb-2">
            System Status
          </h1>
          <p className="text-muted-foreground text-sm">
            This page is illustrative — live uptime monitoring isn&apos;t wired
            up yet. For a real-time incident, contact support directly.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 divide-y-2 divide-border">
            {components.map((component) => (
              <div
                key={component.name}
                className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
              >
                <span className="font-bold text-foreground">
                  {component.name}
                </span>
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400">
                  {component.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
