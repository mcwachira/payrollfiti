import { Card, CardContent } from '@/components/ui/card';

export default function TermsPage() {
  return (
    <div className="py-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
        <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mb-2">
          Terms of Service
        </h1>
        <p className="text-muted-foreground mb-10">
          Last updated: January 1, 2026
        </p>

        <Card>
          <CardContent className="pt-6 space-y-6 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="text-lg font-extrabold text-foreground mb-2">
                1. Acceptance of Terms
              </h2>
              <p>
                By creating an account or using PayFlow Africa, you agree to be
                bound by these Terms of Service and our Privacy Policy. If you
                are using the platform on behalf of an organization, you
                represent that you have authority to bind that organization to
                these terms.
              </p>
            </section>
            <section>
              <h2 className="text-lg font-extrabold text-foreground mb-2">
                2. The Service
              </h2>
              <p>
                PayFlow Africa provides payroll processing, statutory compliance
                calculations, employee record management, and related HR tools.
                Statutory calculations reflect current published rules at the
                time of processing; you remain responsible for verifying and
                filing statutory returns with the relevant authorities.
              </p>
            </section>
            <section>
              <h2 className="text-lg font-extrabold text-foreground mb-2">
                3. Accounts & Responsibilities
              </h2>
              <p>
                You are responsible for the accuracy of data entered into the
                platform, for keeping your account credentials secure, and for
                the actions of users you invite into your tenant. You must not
                use the service to process payroll for individuals without a
                lawful basis to do so.
              </p>
            </section>
            <section>
              <h2 className="text-lg font-extrabold text-foreground mb-2">
                4. Billing
              </h2>
              <p>
                Subscription fees are billed in advance on the plan cycle you
                select. Trials convert to a paid subscription unless canceled
                before the trial ends. You may cancel at any time; no refunds
                are provided for partial billing periods except where required
                by law.
              </p>
            </section>
            <section>
              <h2 className="text-lg font-extrabold text-foreground mb-2">
                5. Data Ownership
              </h2>
              <p>
                You retain ownership of the employee and payroll data you
                submit. We process it solely to provide the service, as
                described in our Privacy Policy.
              </p>
            </section>
            <section>
              <h2 className="text-lg font-extrabold text-foreground mb-2">
                6. Limitation of Liability
              </h2>
              <p>
                The service is provided "as is." To the maximum extent permitted
                by law, PayFlow Africa is not liable for indirect, incidental,
                or consequential damages arising from use of the platform,
                including errors in third-party statutory filing systems outside
                our control.
              </p>
            </section>
            <section>
              <h2 className="text-lg font-extrabold text-foreground mb-2">
                7. Changes to These Terms
              </h2>
              <p>
                We may update these terms from time to time. Continued use of
                the service after changes take effect constitutes acceptance of
                the revised terms.
              </p>
            </section>
            <section>
              <h2 className="text-lg font-extrabold text-foreground mb-2">
                8. Contact
              </h2>
              <p>
                Questions about these terms can be sent to
                hello@payflow-africa.com or via our{' '}
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
