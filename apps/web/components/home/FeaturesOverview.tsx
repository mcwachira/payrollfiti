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
      'Stay compliant with PAYE, NSSF, NHIF, and other African regulatory requirements.',
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
      'Expand across Africa with localized compliance for Kenya, Uganda, Nigeria, and more.',
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
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Everything You Need for Modern HR & Payroll
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Streamline your entire HR and payroll process with our comprehensive
            suite of tools
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="p-6 hover:shadow-lg transition-shadow border-0 bg-card"
            >
              <div
                className={`w-12 h-12 ${feature.color} rounded-lg flex items-center justify-center mb-4`}
              >
                <feature.icon className="h-6 w-6 text-white" />
              </div>

              <h3 className="text-xl font-semibold text-card-foreground mb-3">
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
