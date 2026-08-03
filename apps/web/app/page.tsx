import type { Metadata } from 'next';
import ComplianceSection from '@/components/home/ComplianceSection';
import FeaturesOverview from '@/components/home/FeaturesOverview';
import Header from '@/components/home/Header';
import HeroSection from '@/components/home/HeroSection';
import WhyPayrollFiti from '@/components/home/WhyPayrollFiti';
import TestimonialsSection from '@/components/home/TestimonialsSection';
import CTABanner from '@/components/home/CTABanner';
import Footer from '@/components/home/Footer';
import { JsonLd } from '@/components/JsonLd';
import { APP_NAME, SITE_URL } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Payroll & Statutory Compliance Software for Africa',
  description:
    'Run payroll and stay compliant in Kenya, Nigeria, and South Africa. Automatic PAYE, NSSF, SHIF, and payslip generation — built for how African businesses actually operate.',
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

const Home = () => {
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

export default Home;
