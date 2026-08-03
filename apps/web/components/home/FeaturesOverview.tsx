import { Card } from '@/components/ui/card';
import {
  Calculator,
  Shield,
  Users,
  FileText,
  Globe,
  BarChart3,
} from 'lucide-react';

const features = [
  {
    icon: Calculator,
    title: 'Payroll Automation',
    description:
      'Automate complex payroll calculations with built-in tax brackets and statutory deductions.',
    color: 'bg-blue-500',
  },
  {
    icon: Shield,
    title: 'Statutory Compliance',
    description:
      'PAYE, NSSF, SHIF, and the Housing Levy calculated automatically, using current KRA rule sets.',
    color: 'bg-green-500',
  },
  {
    icon: Users,
    title: 'Employee Self-Service',
    description:
      'Empower employees with self-service portals for payslips, leave requests, and profile updates.',
    color: 'bg-purple-500',
  },
  {
    icon: FileText,
    title: 'Payslip Generation',
    description:
      'Generate professional payslips with detailed breakdowns and statutory information.',
    color: 'bg-orange-500',
  },
  {
    icon: Globe,
    title: 'Multi-country Support',
    description:
      'Localized compliance rule sets for Kenya, Nigeria, and South Africa, in one platform.',
    color: 'bg-teal-500',
  },
  {
    icon: BarChart3,
    title: 'Reports & Remittances',
    description:
      'Generate comprehensive reports and automate statutory remittances to authorities.',
    color: 'bg-rose-500',
  },
];

const FeaturesOverview = () => {
  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
            Payroll Software Built for Kenya, Nigeria & South Africa
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Run payroll, stay statutory-compliant, and manage your team from one
            platform — designed around how African businesses actually operate.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="p-6 bg-card transition-transform hover:-translate-x-1 hover:-translate-y-1 hover:shadow-brutal-lg"
            >
              <div
                className={`w-12 h-12 ${feature.color} rounded-lg border-2 border-border flex items-center justify-center mb-4`}
              >
                <feature.icon className="h-6 w-6 text-white" />
              </div>

              <h3 className="text-xl font-extrabold text-card-foreground mb-3">
                {feature.title}
              </h3>

              <p className="text-muted-foreground">{feature.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesOverview;
