export interface Testimonial {
  name: string;
  role: string;
  company: string;
  image: string;
  content: string;
  rating: number;
}

/**
 * Shared between the homepage teaser (TestimonialsSection, first 3) and the
 * full /reviews page (all of them).
 */
export const testimonials: Testimonial[] = [
  {
    name: 'Sarah Mwangi',
    role: 'HR Director',
    company: 'TechStart Kenya',
    image:
      'https://images.unsplash.com/photo-1494790108755-2616b612b5ad?w=150&h=150&fit=crop&crop=face',
    content:
      'PayrollFiti transformed our payroll process. What used to take us 3 days now takes 30 minutes. The compliance features give us peace of mind.',
    rating: 5,
  },
  {
    name: 'James Ochieng',
    role: 'Finance Manager',
    company: 'Green Energy Solutions',
    image:
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
    content:
      'The statutory compliance features are incredible. We never worry about PAYE, NSSF, or SHIF calculations anymore. Everything is automated and accurate.',
    rating: 5,
  },
  {
    name: 'Grace Nduku',
    role: 'CEO',
    company: 'Mama Foods Ltd',
    image:
      'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop&crop=face',
    content:
      'As a growing business, PayrollFiti scales with us. The employee self-service portal reduced HR queries by 70%. Highly recommended!',
    rating: 5,
  },
  {
    name: 'Chidinma Okafor',
    role: 'People Operations Lead',
    company: 'Lagos FinTech Hub',
    image:
      'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=150&h=150&fit=crop&crop=face',
    content:
      'Running payroll across Nigeria used to mean spreadsheets and guesswork on PAYE and pension contributions. PayrollFiti handles it correctly every time, and the payslips are branded with our own logo.',
    rating: 5,
  },
  {
    name: 'Thabo Nkosi',
    role: 'Financial Controller',
    company: 'Cape Coastal Logistics',
    image:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
    content:
      "UIF and SDL used to be a manual reconciliation nightmare at month-end. Now it's just there, correct, on every payslip. The bank export file alone saves our team a full day each cycle.",
    rating: 5,
  },
  {
    name: 'Amina Yusuf',
    role: 'Operations Manager',
    company: 'Coastal Retail Group',
    image:
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&h=150&fit=crop&crop=face',
    content:
      "Loan and salary advance requests used to live in someone's inbox. Now employees see their repayment schedule right in the portal, and it deducts automatically from the right payroll run.",
    rating: 4,
  },
];
