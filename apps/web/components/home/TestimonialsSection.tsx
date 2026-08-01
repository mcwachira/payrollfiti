import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star } from 'lucide-react';

const testimonials = [
  {
    name: 'Sarah Mwangi',
    role: 'HR Director',
    company: 'TechStart Kenya',
    image:
      'https://images.unsplash.com/photo-1494790108755-2616b612b5ad?w=150&h=150&fit=crop&crop=face',
    content:
      'PayFlow Africa transformed our payroll process. What used to take us 3 days now takes 30 minutes. The compliance features give us peace of mind.',
    rating: 5,
  },
  {
    name: 'James Ochieng',
    role: 'Finance Manager',
    company: 'Green Energy Solutions',
    image:
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
    content:
      'The statutory compliance features are incredible. We never worry about PAYE, NSSF, or NHIF calculations anymore. Everything is automated and accurate.',
    rating: 5,
  },
  {
    name: 'Grace Nduku',
    role: 'CEO',
    company: 'Mama Foods Ltd',
    image:
      'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop&crop=face',
    content:
      'As a growing business, PayFlow Africa scales with us. The employee self-service portal reduced HR queries by 70%. Highly recommended!',
    rating: 5,
  },
];

const TestimonialsSection = () => {
  return (
    <section id="testimonials" className="py-20 bg-muted/30 scroll-mt-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
            Trusted by Growing Businesses Across Africa
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            See how PayFlow Africa is helping businesses streamline their HR and
            payroll operations
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="p-6 bg-card">
              {/* Rating */}
              <div className="flex mb-4">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star
                    key={i}
                    className="h-5 w-5 fill-yellow-400 text-yellow-400"
                  />
                ))}
              </div>

              {/* Content */}
              <p className="text-muted-foreground mb-6 italic">
                "{testimonial.content}"
              </p>

              {/* Author */}
              <div className="flex items-center">
                <Avatar className="h-12 w-12 mr-4 border-2 border-border">
                  <AvatarImage src={testimonial.image} alt={testimonial.name} />
                  <AvatarFallback>
                    {testimonial.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </AvatarFallback>
                </Avatar>

                <div>
                  <div className="font-extrabold text-card-foreground">
                    {testimonial.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {testimonial.role}, {testimonial.company}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
