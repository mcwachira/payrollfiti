import { ArrowRight, Play } from 'lucide-react';
import { Button } from '../ui/button';
import Image from 'next/image';

const HeroSection = () => {
  return (
    <section className="relative bg-gradient-to-br from-blue-50 via-green-50 to-orange-50 min-h-screen flex items-center">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-green-600/5" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className="text-center lg:text-left">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
              Effortless Payroll and
              <span className="text-primary"> HR Compliance</span>
              <br />
              Across Africa
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl">
              Manage payroll, statutory deductions, and HR tasks in one
              powerful, cloud-based platform — fully compliant with Kenya's
              PAYE, NSSF, and NHIF requirements.
            </p>

            <div className="flex flex-col sm:flxe-row gap-4 justify-center lg:justify-start">
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4"
              >
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="border-primary text-primary hover:bg-primary/10 px-8 py-4"
              >
                <Play className="mr-2 h-5 w-5" />
                Request a Demo
              </Button>
            </div>

            <div className="mt-8 mb-2 flex flex-wrap gap-6 justify-center lg:justify-start text-sm text-muted-foreground">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                Free 30-day trial
              </div>

              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                No setup fees
              </div>

              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                Cancel anytime
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="bg-white rounded-2xl shadow-2xl p-8 border">
              {/* Responsive Image */}
              <div className="relative w-full h-80 md:h-96 lg:h-[400px] rounded-lg overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600&h=400&fit=crop"
                  alt="Professional using PayFlow Africa platform"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 100vw, 600px"
                  priority
                />
              </div>

              {/* Floating Cards */}
              <div className="absolute -top-4 -left-4 bg-primary text-primary-foreground p-4 rounded-lg shadow-lg">
                <div className="text-2xl font-bold">1,000+</div>
                <div className="text-sm opacity-90">Businesses Trust Us</div>
              </div>

              <div className="absolute -bottom-4 -right-4 bg-green-600 text-white p-4 rounded-lg shadow-lg">
                <div className="text-2xl font-bold">99.9%</div>
                <div className="text-sm opacity-90">Compliance Rate</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
