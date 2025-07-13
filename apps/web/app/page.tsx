import FeaturesOverview from '@/components/home/FeaturesOverview';
import { Header } from '@/components/home/Header';
import HeroSection from '@/components/home/HeroSection';
import WhyPayFlow from '@/components/home/WhyPayFlow';

const Home = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <HeroSection />

      <FeaturesOverview />
      <WhyPayFlow />
      {/* <ComplianceSection /> */}
      {/* <TestimonialsSection /> */}
      {/* <CTABanner /> */}
      {/* <Footer /> */}
    </div>
  );
};

export default Home;
