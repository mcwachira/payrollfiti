import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/config';
import { getPublishedSlugs } from '@/lib/sanity-client';

// Pages worth a search engine's attention — deliberately excludes noindex
// legal/status pages (cookies, privacy, terms, status) and the
// authenticated app (see robots.ts).
const STATIC_ROUTES = [
  { path: '', priority: 1, changeFrequency: 'weekly' as const },
  { path: '/features', priority: 0.9, changeFrequency: 'monthly' as const },
  { path: '/pricing', priority: 0.9, changeFrequency: 'monthly' as const },
  { path: '/blog', priority: 0.8, changeFrequency: 'weekly' as const },
  { path: '/reviews', priority: 0.6, changeFrequency: 'monthly' as const },
  { path: '/help', priority: 0.7, changeFrequency: 'monthly' as const },
  { path: '/contact', priority: 0.5, changeFrequency: 'yearly' as const },
  { path: '/community', priority: 0.3, changeFrequency: 'monthly' as const },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  const staticEntries = STATIC_ROUTES.map(
    ({ path, priority, changeFrequency }) => ({
      url: `${SITE_URL}${path}`,
      lastModified,
      changeFrequency,
      priority,
    }),
  );

  const posts = await getPublishedSlugs();
  const postEntries = posts.map(({ slug, updatedAt }) => ({
    url: `${SITE_URL}/blog/${slug}`,
    lastModified: new Date(updatedAt),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  return [...staticEntries, ...postEntries];
}
