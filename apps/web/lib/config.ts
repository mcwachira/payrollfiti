export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'PayrollFiti';
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
/** Canonical production origin — used for metadataBase, canonical URLs, the
 *  sitemap, and JSON-LD. Update once a real domain is live; every SEO tag
 *  that depends on it is derived from here, not hardcoded per-page. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://payrollfiti.com';
