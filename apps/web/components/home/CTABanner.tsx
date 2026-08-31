import Link from 'next/link';
import { ArrowRight, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CTABanner = () => {
  return (
    <section className="py-20 bg-primary border-y-2 border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-center mb-6">
            <div className="bg-white p-4 rounded-full border-2 border-border shadow-brutal">
              <Users className="h-12 w-12 text-primary" />
            </div>
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-muted-foreground  mb-4">
            Transform How You Run Payroll Across Africa
          </h2>
          <p className="text-xl text-muted-foreground  mb-8 max-w-2xl mx-auto">
            Start your journey to effortless payroll management and statutory
            compliance today. No setup fees, no long-term contracts.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              asChild
            >
              <Link href="/signup">
                Start Your Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>

            <Button
              variant="neutral"
              size="lg"
              asChild
            >
              <Link href="/contact">See a Demo</Link>
            </Button>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap gap-6 justify-center font-bold text-muted-foreground ">
          <div>✓ 30-day free trial</div>
          <div>✓ No credit card required</div>
          <div>✓ Cancel anytime</div>
          <div>✓ Full customer support</div>
        </div>
      </div>
    </section>
  );
};

export default CTABanner;
