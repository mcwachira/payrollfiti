import type { Metadata } from 'next';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: 'How PayrollFiti uses cookies across the site and app.',
  alternates: { canonical: '/cookies' },
  robots: { index: false, follow: true },
};

export default function CookiePolicyPage() {
  return (
    <div className="py-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
        <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mb-2">
          Cookie Policy
        </h1>
        <p className="text-muted-foreground mb-10">
          Last updated: January 1, 2026
        </p>

        <Card>
          <CardContent className="pt-6 space-y-6 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="text-lg font-extrabold text-foreground mb-2">
                What Cookies We Use
              </h2>
              <p>
                PayrollFiti uses a small number of cookies and browser storage
                mechanisms needed to operate the platform:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>
                  <span className="font-bold text-foreground">Essential:</span>{' '}
                  session and authentication state, so you stay signed in as you
                  navigate the app.
                </li>
                <li>
                  <span className="font-bold text-foreground">Preference:</span>{' '}
                  your dark/light mode choice, stored locally in your browser.
                </li>
                <li>
                  <span className="font-bold text-foreground">
                    Offline cache:
                  </span>{' '}
                  the employee portal caches payslip data locally so it remains
                  viewable without a connection.
                </li>
              </ul>
            </section>
            <section>
              <h2 className="text-lg font-extrabold text-foreground mb-2">
                What We Don't Use
              </h2>
              <p>
                We do not use third-party advertising or cross-site tracking
                cookies on the marketing site or in the application.
              </p>
            </section>
            <section>
              <h2 className="text-lg font-extrabold text-foreground mb-2">
                Managing Cookies
              </h2>
              <p>
                Most browsers let you block or delete cookies in their settings.
                Because our essential cookies are required for sign-in,
                disabling them will prevent you from using the authenticated
                part of the platform.
              </p>
            </section>
            <section>
              <h2 className="text-lg font-extrabold text-foreground mb-2">
                Contact
              </h2>
              <p>
                Questions about this policy can be sent to hello@payrollfiti.com
                or via our{' '}
                <a href="/contact" className="text-primary underline">
                  contact page
                </a>
                .
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
