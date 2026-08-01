import Link from 'next/link';
import { Newspaper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function BlogPage() {
  return (
    <div className="py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-2xl text-center">
        <Card>
          <CardContent className="pt-10 pb-10 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-border flex items-center justify-center mb-6">
              <Newspaper className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-extrabold text-foreground mb-3">
              The Blog Is Coming Soon
            </h1>
            <p className="text-muted-foreground mb-8">
              We&apos;re working on payroll and compliance guides for African
              businesses. In the meantime, our support team is happy to answer
              questions directly.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild>
                <Link href="/help">Visit Help Center</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/contact">Contact Us</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
