import type { Metadata } from 'next';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How PayrollFiti collects, stores, and protects your data.',
  alternates: { canonical: '/privacy' },
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  return (
    <div className="py-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
        <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mb-2">
          Privacy Policy
        </h1>
        <p className="text-muted-foreground mb-10">
          Last updated: January 1, 2026
        </p>

        <Card>
          <CardContent className="pt-6 space-y-6 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="text-lg font-extrabold text-foreground mb-2">
                1. Information We Collect
              </h2>
              <p>
                To provide payroll and HR services, PayrollFiti processes
                information you and your organization provide, including
                employee names, contact details, statutory identifiers (KRA PIN,
                NSSF and NHIF numbers), bank details, and compensation data. We
                also collect account information for the individuals who use our
                platform (name, email, role).
              </p>
            </section>
            <section>
              <h2 className="text-lg font-extrabold text-foreground mb-2">
                2. How We Use Information
              </h2>
              <p>
                We use this information to calculate payroll and statutory
                deductions, generate payslips and compliance reports, operate
                employee self-service features, process billing, and provide
                customer support. We do not sell personal data.
              </p>
            </section>
            <section>
              <h2 className="text-lg font-extrabold text-foreground mb-2">
                3. Data Storage & Security
              </h2>
              <p>
                Sensitive fields such as statutory identifiers and bank account
                numbers are encrypted at rest. Access to tenant data is scoped
                by role and audited. Data is hosted on infrastructure located in
                and serving the regions we operate in.
              </p>
            </section>
            <section>
              <h2 className="text-lg font-extrabold text-foreground mb-2">
                4. Data Retention
              </h2>
              <p>
                We retain payroll records for as long as required by applicable
                Kenyan tax and labor law, and for the duration of your
                subscription plus a reasonable period thereafter for legal and
                accounting purposes.
              </p>
            </section>
            <section>
              <h2 className="text-lg font-extrabold text-foreground mb-2">
                5. Your Rights
              </h2>
              <p>
                You may request access to, correction of, or deletion of
                personal data we hold about you, subject to our legal obligation
                to retain payroll records. Contact us at hello@payrollfiti.com
                to make a request.
              </p>
            </section>
            <section>
              <h2 className="text-lg font-extrabold text-foreground mb-2">
                6. Contact
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
