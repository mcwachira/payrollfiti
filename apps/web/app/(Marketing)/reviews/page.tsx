import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, MessageSquareQuote } from 'lucide-react';
import { testimonials } from '@/lib/testimonial-data';

export const metadata: Metadata = {
  title: 'Reviews',
  description:
    'What running payroll on PayrollFiti looks like for HR and finance teams in Kenya, Nigeria, and South Africa.',
  alternates: { canonical: '/reviews' },
};

export default function ReviewsPage() {
  return (
    <div className="py-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 border-2 border-border mb-4">
            <MessageSquareQuote className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
            What Running Payroll on PayrollFiti Looks Like
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Illustrative scenarios for HR and finance teams running payroll
            across Kenya, Nigeria, and South Africa.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="p-6 bg-card">
              <div className="flex mb-4">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star
                    key={i}
                    className="h-5 w-5 fill-yellow-400 text-yellow-400"
                  />
                ))}
              </div>

              <p className="text-muted-foreground mb-6 italic">
                "{testimonial.content}"
              </p>

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

        <Card className="text-center bg-primary text-primary-foreground">
          <CardHeader>
            <CardTitle>Used PayrollFiti for your team?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-primary-foreground/90 mb-4">
              We&apos;d love to hear how it&apos;s working for you — good or
              bad.
            </p>
            <Button asChild className="bg-white text-primary hover:bg-white">
              <Link href="/contact">Share Your Story</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
