import type { Metadata } from 'next';
import Link from 'next/link';
import { Newspaper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { JsonLd } from '@/components/JsonLd';
import { getPublishedPosts } from '@/lib/sanity-client';
import { SITE_URL, APP_NAME } from '@/lib/config';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Blog — Payroll & Compliance Guides for Africa',
  description:
    'Practical guides on PAYE, NSSF, SHIF, and payroll compliance for Kenya, Nigeria, and South Africa.',
  alternates: { canonical: '/blog' },
};

const COUNTRY_LABELS: Record<string, string> = {
  KE: 'Kenya',
  NG: 'Nigeria',
  ZA: 'South Africa',
  GENERAL: 'General',
};

function EmptyState() {
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

export default async function BlogPage() {
  const posts = await getPublishedPosts();

  if (posts.length === 0) {
    return <EmptyState />;
  }

  const blogJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: `${APP_NAME} Blog`,
    url: `${SITE_URL}/blog`,
    blogPost: posts.map((post) => ({
      '@type': 'BlogPosting',
      headline: post.title,
      url: `${SITE_URL}/blog/${post.slug}`,
      datePublished: post.publishedAt,
    })),
  };

  return (
    <div className="py-20">
      <JsonLd data={blogJsonLd} />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
            Payroll & Compliance Guides
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Practical guides on PAYE, NSSF, SHIF, and running payroll in Kenya,
            Nigeria, and South Africa.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`}>
              <Card className="h-full p-6 transition-transform hover:-translate-x-1 hover:-translate-y-1 hover:shadow-brutal-lg">
                <Badge variant="outline" className="mb-3 w-fit">
                  {COUNTRY_LABELS[post.countryFocus] ?? post.countryFocus}
                </Badge>
                <h2 className="text-xl font-extrabold text-card-foreground mb-2">
                  {post.title}
                </h2>
                <p className="text-muted-foreground mb-4">{post.excerpt}</p>
                <p className="text-xs text-muted-foreground mt-auto">
                  {new Date(post.publishedAt).toLocaleDateString('en', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
