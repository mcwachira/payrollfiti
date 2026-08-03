import Link from 'next/link';
import { ArrowRight, Play } from 'lucide-react';
import { Button } from '../ui/button';
import Image from 'next/image';

const HeroSection = () => {
  return (
    <section className="relative bg-secondary border-b-2 border-border flex items-center">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className="text-center lg:text-left">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground mb-6 leading-tight">
              Payroll and Statutory
              <span className="text-primary"> Compliance</span>
              <br />
              Built for Africa
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl">
              Run payroll, calculate statutory deductions, and manage your team
              in one cloud-based platform — live in Kenya, Nigeria, and South
              Africa today, with more African countries on the way.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button size="lg" className="px-8 py-4" asChild>
                <Link href="/signup">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>

              <Button variant="outline" size="lg" className="px-8 py-4" asChild>
                <Link href="/contact">
                  <Play className="mr-2 h-5 w-5" />
                  Request a Demo
                </Link>
              </Button>
            </div>

            <div className="mt-8 mb-2 flex flex-wrap gap-6 justify-center lg:justify-start text-sm font-bold text-muted-foreground">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full border border-border mr-2" />
                Free 30-day trial
              </div>

              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full border border-border mr-2" />
                No setup fees
              </div>

              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full border border-border mr-2" />
                Cancel anytime
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="bg-card rounded-2xl shadow-brutal-lg p-8 border-2 border-border">
              {/* Responsive Image */}
              <div className="relative w-full h-80 md:h-96 lg:h-[400px] rounded-lg overflow-hidden border-2 border-border">
                <Image
                  src="https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600&h=400&fit=crop"
                  alt="Professional using PayrollFiti platform"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 100vw, 600px"
                  priority
                />
              </div>

              {/* Floating Cards */}
              <div className="absolute -top-4 -left-4 bg-primary text-primary-foreground p-4 rounded-lg border-2 border-border shadow-brutal">
                <div className="text-2xl font-extrabold">3</div>
                <div className="text-sm opacity-90">
                  Countries Live, More Coming
                </div>
              </div>

              <div className="absolute -bottom-4 -right-4 bg-green-600 text-white p-4 rounded-lg border-2 border-border shadow-brutal">
                <div className="text-2xl font-extrabold">
                  PAYE · NSSF · SHIF
                </div>
                <div className="text-sm opacity-90">
                  Calculated Automatically
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
