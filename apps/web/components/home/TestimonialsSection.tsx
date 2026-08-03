import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Star, ArrowRight } from 'lucide-react';
import { testimonials } from '@/lib/testimonials-data';

const TestimonialsSection = () => {
  const featured = testimonials.slice(0, 3);

  return (
    <section id="testimonials" className="py-20 bg-muted/30 scroll-mt-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
            What Running Payroll on PayrollFiti Looks Like
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Illustrative scenarios based on the problems PayrollFiti is built to
            solve for HR and finance teams across Africa
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {featured.map((testimonial, index) => (
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

        <div className="text-center mt-10">
          <Button variant="outline" asChild>
            <Link href="/reviews">
              Read more reviews
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
