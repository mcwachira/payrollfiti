import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/config';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // The authenticated app and single-use token flows have nothing for a
      // search engine to usefully index, and app pages would 401/redirect
      // for an unauthenticated crawler anyway.
      disallow: [
        '/account',
        '/analytics',
        '/audit-log',
        '/billing',
        '/blog-admin',
        '/compliance',
        '/dashboard',
        '/employee-portal',
        '/employees',
        '/leave',
        '/loans',
        '/onboarding',
        '/payroll',
        '/settings',
        '/forgot-password',
        '/reset-password',
        '/accept-invite',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
