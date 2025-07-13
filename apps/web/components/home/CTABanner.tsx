import { ArrowRight, Section, Users } from 'lucide-react';
import { Button } from '../ui/button';

const CTABanner = () => {
  return (
    <section className="py-20 bg-gradient-to-r from-primary to-primary/80">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-center mb-6">
            <div className="bg-white/20 p-4 rounded-full">
              <Users className="h-12 w-12 text-white" />
            </div>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Join 1,000+ Businesses Transforming Payroll Across Africa
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Start your journey to effortless payroll management and statutory
            compliance today. No setup fees, no long-term contracts.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-white text-primary hover:bg-white/90 px-8 py-4 text-lg font-semibold"
            >
              Start Your Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="border-white text-black hover:bg-white/10 px-8 py-4 text-lg font-semibold"
            >
              See a Demo
            </Button>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap gap-6 justify-center text-white/80">
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
