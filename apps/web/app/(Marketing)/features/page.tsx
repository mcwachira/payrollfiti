import type { Metadata } from 'next';
import Link from 'next/link';
import {
    Calculator,
    Shield,
    Users,
    FileText,
    Globe,
    BarChart3,
    Calendar,
    CreditCard,
    UserCircle,
    Landmark,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const features = [
    {
        icon: Calculator,
        title: 'Payroll Automation',
        description:
            'Run payroll in minutes, not days. Gross-to-net calculations, statutory deductions, and payslips are generated automatically for every employee, every period.',
        color: 'bg-blue-500',
    },
    {
        icon: Shield,
        title: 'Statutory Compliance',
        description:
            'PAYE, NSSF, SHIF, and the Housing Levy are calculated using up-to-date KRA rule sets, with remittance files ready for submission.',
        color: 'bg-green-500',
    },
    {
        icon: Users,
        title: 'Employee Records',
        description:
            'A single source of truth for every employee — bank details, statutory numbers, employment history, and documents, all in one place.',
        color: 'bg-purple-500',
    },
    {
        icon: FileText,
        title: 'Payslips & Compliance Reports',
        description:
            'Generate professional payslips, P9 tax certificates, and P10/NSSF/SHIF remittance files directly from the platform.',
        color: 'bg-orange-500',
    },
    {
        icon: Calendar,
        title: 'Leave Management',
        description:
            'Employees request leave and see their balances; managers approve from one dashboard, fully synced with payroll.',
        color: 'bg-teal-500',
    },
    {
        icon: BarChart3,
        title: 'Payroll Analytics',
        description:
            'Track headcount, payroll cost trends, and department breakdowns with a live analytics dashboard.',
        color: 'bg-rose-500',
    },
    {
        icon: UserCircle,
        title: 'Employee Self-Service',
        description:
            'Employees log in to view payslips, download documents, and manage their own leave requests — no more HR back-and-forth.',
        color: 'bg-indigo-500',
    },
    {
        icon: CreditCard,
        title: 'Billing & Subscriptions',
        description:
            'Manage your plan, view invoices, and pay via card or M-Pesa directly from the app.',
        color: 'bg-cyan-500',
    },
    {
        icon: Landmark,
        title: 'Bank Export',
        description:
            'Generate bank-ready export files for salary disbursement, matched to each payroll run.',
        color: 'bg-amber-500',
    },
    {
        icon: Globe,
        title: 'Built to Expand Across Africa',
        description:
            'Country-specific rule sets for Kenya, Nigeria, and South Africa already live in the engine, with more African countries on the roadmap.',
        color: 'bg-lime-500',
    },
];

export const metadata: Metadata = {
    title: 'Features — Payroll, Compliance & HR Tools',
    description:
        'Payroll automation, PAYE/NSSF/SHIF compliance, payslips, leave management, analytics, and bank export — built for Africa, live in Kenya, Nigeria, and South Africa today.',
    alternates: { canonical: '/features' },
};

export default function FeaturesPage() {
    return (
        <div className="py-20">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
                        Everything You Need for Modern HR & Payroll
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        One platform for payroll, compliance, and your team — built for how
                        African businesses actually run payroll.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
                    {features.map((feature) => (
                        <Card
                            key={feature.title}
                            className="p-6 transition-transform hover:-translate-x-1 hover:-translate-y-1 hover:shadow-brutal-lg"
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

                <Card className="max-w-2xl mx-auto text-center bg-primary text-primary-foreground">
                    <CardHeader>
                        <CardTitle className="text-2xl">
                            Ready to see it in action?
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Button asChild className="bg-white text-primary hover:bg-white">
                            <Link href="/signup">Start Free Trial</Link>
                        </Button>
                        <Button
                            asChild
                            variant="default"

                        >
                            <Link href="/contact">Request a Demo</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
