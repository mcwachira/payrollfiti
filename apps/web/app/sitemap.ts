import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/config';

// Pages worth a search engine's attention — deliberately excludes noindex
// legal/status pages (cookies, privacy, terms, status) and the
// authenticated app (see robots.ts).
const STATIC_ROUTES = [
  { path: '', priority: 1, changeFrequency: 'weekly' as const },
  { path: '/features', priority: 0.9, changeFrequency: 'monthly' as const },
  { path: '/pricing', priority: 0.9, changeFrequency: 'monthly' as const },
  { path: '/reviews', priority: 0.6, changeFrequency: 'monthly' as const },
  { path: '/help', priority: 0.7, changeFrequency: 'monthly' as const },
  { path: '/contact', priority: 0.5, changeFrequency: 'yearly' as const },
  { path: '/community', priority: 0.3, changeFrequency: 'monthly' as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return STATIC_ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
