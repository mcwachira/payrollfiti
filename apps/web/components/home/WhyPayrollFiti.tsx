import { Card } from '@/components/ui/card';
import { MapPin, Zap, Shield, Clock } from 'lucide-react';

const benefits = [
  {
    icon: MapPin,
    title: 'Localized for African Regulations',
    description:
      'Built specifically for Kenyan, Nigerian, and South African tax law and statutory requirements — not a global product with Africa bolted on.',
  },
  {
    icon: Zap,
    title: 'API, Webhooks & Accounting Sync',
    description:
      'A read-only public API, outbound webhooks, and direct sync to QuickBooks, Xero, or Zoho Books — connect payroll to the rest of your stack.',
  },
  {
    icon: Shield,
    title: 'Built Security-First',
    description:
      'Field-level encryption for sensitive employee data, role-based access control, two-factor authentication, and a full audit trail.',
  },
  {
    icon: Clock,
    title: 'Run Payroll in Minutes',
    description:
      'Gross-to-net calculations, statutory deductions, and payslips generated automatically for every employee, every period — no spreadsheets.',
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

          {/* What the platform actually does */}
          <div className="grid grid-cols-2 gap-6">
            <Card className="p-6 text-center bg-primary text-primary-foreground">
              <div className="text-3xl font-extrabold mb-2">3</div>
              <div className="text-sm opacity-90">Countries Supported</div>
            </Card>

            <Card className="p-6 text-center bg-green-600 text-white">
              <div className="text-3xl font-extrabold mb-2">Auto</div>
              <div className="text-sm opacity-90">
                Statutory Remittance Files
              </div>
            </Card>

            <Card className="p-6 text-center bg-orange-500 text-white">
              <div className="text-3xl font-extrabold mb-2">Minutes</div>
              <div className="text-sm opacity-90">
                To Run a Full Payroll Cycle
              </div>
            </Card>

            <Card className="p-6 text-center bg-purple-600 text-white">
              <div className="text-3xl font-extrabold mb-2">Real-Time</div>
              <div className="text-sm opacity-90">Payroll Cost Analytics</div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhyPayrollFiti;
