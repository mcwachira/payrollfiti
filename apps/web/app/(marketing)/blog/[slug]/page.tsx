import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { marked } from 'marked';
import { Badge } from '@/components/ui/badge';
import { JsonLd } from '@/components/JsonLd';
import { getPublishedPostBySlug, getPublishedSlugs } from '@/lib/sanity-client';
import { SITE_URL, APP_NAME } from '@/lib/config';

export const revalidate = 300;

const COUNTRY_LABELS: Record<string, string> = {
  KE: 'Kenya',
  NG: 'Nigeria',
  ZA: 'South Africa',
  GENERAL: 'General',
};

export async function generateStaticParams() {
  const slugs = await getPublishedSlugs();
  return slugs.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) return {};

  const title = post.seoTitle || post.title;
  const description = post.seoDescription || post.excerpt;
  return {
    title,
    description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      type: 'article',
      title,
      description,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      images: post.coverImageUrl ? [post.coverImageUrl] : undefined,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) {
    notFound();
  }

  const bodyHtml = await marked.parse(post.body);

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    image: post.coverImageUrl ? [post.coverImageUrl] : undefined,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: { '@type': 'Organization', name: APP_NAME },
    publisher: { '@type': 'Organization', name: APP_NAME },
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
  };

  return (
    <div className="py-16">
      <JsonLd data={articleJsonLd} />
      <article className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-2xl">
        <Badge variant="outline" className="mb-4">
          {COUNTRY_LABELS[post.countryFocus] ?? post.countryFocus}
        </Badge>
        <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
          {post.title}
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          {new Date(post.publishedAt).toLocaleDateString('en', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
        {post.coverImageUrl && (
          // Cover images come from an editor-supplied external URL, not a
          // domain this app controls — next/image's domain allowlist would
          // need updating per-image, so a plain <img> avoids that friction
          // for content that changes without a deploy.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.coverImageUrl}
            alt={post.title}
            className="w-full rounded-lg border-2 border-border mb-8"
          />
        )}
        <div
          className="prose dark:prose-invert max-w-none"
          // bodyHtml comes from marked.parse() over Markdown written by an
          // ADMIN through /blog-admin — not end-user input.
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      </article>
    </div>
  );
}
