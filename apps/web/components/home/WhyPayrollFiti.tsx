import { Card } from '@/components/ui/card';
import { MapPin, Zap, Shield, Clock } from 'lucide-react';

const benefits = [
  {
    icon: MapPin,
    title: 'Localized for African Regulations',
    description:
      'Built specifically for African tax laws, labor regulations, and compliance requirements.',
  },
  {
    icon: Zap,
    title: 'API Integration Ready',
    description:
      'Seamlessly integrate with banks, government portals, and third-party systems.',
  },
  {
    icon: Shield,
    title: 'Cloud-based & Secure',
    description:
      'Enterprise-grade security with 99.9% uptime and automated backups.',
  },
  {
    icon: Clock,
    title: 'Save Time & Reduce Errors',
    description:
      'Eliminate manual calculations and reduce payroll processing time by 80%.',
  },
];

const WhyPayrollFiti = () => {
  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-6">
              Why Choose PayrollFiti?
            </h2>

            <p className="text-lg text-muted-foreground mb-8">
              We understand the unique challenges of managing payroll across
              Africa. Our platform is built by Africans, for Africans.
            </p>

            <div className="space-y-6">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start space-x-4">
                  <div className="bg-primary/10 border-2 border-border p-2 rounded-lg flex-shrink-0">
                    <benefit.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-foreground mb-2">
                      {benefit.title}
                    </h3>
                    <p className="text-muted-foreground">
                      {benefit.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 gap-6">
            <Card className="p-6 text-center bg-primary text-primary-foreground">
              <div className="text-3xl font-extrabold mb-2">1,000+</div>
              <div className="text-sm opacity-90">Businesses Served</div>
            </Card>

            <Card className="p-6 text-center bg-green-600 text-white">
              <div className="text-3xl font-extrabold mb-2">50,000+</div>
              <div className="text-sm opacity-90">Employees Managed</div>
            </Card>

            <Card className="p-6 text-center bg-orange-500 text-white">
              <div className="text-3xl font-extrabold mb-2">99.9%</div>
              <div className="text-sm opacity-90">Uptime Guarantee</div>
            </Card>

            <Card className="p-6 text-center bg-purple-600 text-white">
              <div className="text-3xl font-extrabold mb-2">3</div>
              <div className="text-sm opacity-90">Countries Supported</div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhyPayrollFiti;
