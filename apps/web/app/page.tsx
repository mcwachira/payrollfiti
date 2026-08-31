import { Button } from "@/components/ui/button"
import { APP_NAME, SITE_URL } from '@/lib/config';
import { Metadata } from "next"
import { JsonLd } from "@/components/JsonLd"
import Header from "@/components/home/Header"
import HeroSection from "@/components/home/HeroSection"
import FeaturesOverview from "@/components/home/FeaturesOverview"
import ComplianceSection from "@/components/home/ComplianceSection"
import WhyPayrollFiti from "@/components/home/WhyPayrollFiti"
import Footer from "@/components/home/Footer"
import CTABanner from "@/components/home/CTABanner"
import TestimonialsSection from "@/components/home/TestimonialsSection"

export const metadata: Metadata = {
  title: 'Payroll & Statutory Compliance Software for Africa',
  description:
    'Payroll software built for Africa — live in Kenya, Nigeria, and South Africa today, with more African countries on the roadmap. Automatic PAYE, NSSF, SHIF, and payslip generation.',
  alternates: { canonical: SITE_URL },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: APP_NAME,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description:
    'Payroll and statutory compliance software for Kenya, Nigeria, and South Africa.',
  url: SITE_URL,
  offers: {
    '@type': 'Offer',
    priceCurrency: 'KES',
    availability: 'https://schema.org/InStock',
  },
  areaServed: ['KE', 'NG', 'ZA'],
};
export default function Page() {
  return (
    <div className="min-h-screen bg-background">
      <JsonLd data={organizationJsonLd} />
      <Header />
      <HeroSection />
      <FeaturesOverview />
      <WhyPayrollFiti />
      <ComplianceSection />
      <TestimonialsSection />
      <CTABanner />
      <Footer />
    </div>
  );
};