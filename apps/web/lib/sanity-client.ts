import { createClient } from '@sanity/client';
import { SANITY_PROJECT_ID, SANITY_DATASET } from './config';

export interface PublicBlogPost {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverImageUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  countryFocus: 'KE' | 'NG' | 'ZA' | 'GENERAL';
  publishedAt: string;
  updatedAt: string;
}

const API_VERSION = '2024-01-01';

/**
 * Public, token-less client — reads only `status == "published"` posts via
 * Sanity's CDN-backed API. Distinct from the NestJS BlogModule's client
 * (apps/api/src/blog/blog.service.ts), which holds a write token and is the
 * only thing that can create/edit/delete — this client can't write
 * anything even if it wanted to, since it was never given a token.
 */
function getClient() {
  if (!SANITY_PROJECT_ID) return null;
  return createClient({
    projectId: SANITY_PROJECT_ID,
    dataset: SANITY_DATASET,
    apiVersion: API_VERSION,
    useCdn: true,
  });
}

const POST_PROJECTION = `{
  title,
  "slug": slug,
  excerpt,
  body,
  coverImageUrl,
  seoTitle,
  seoDescription,
  countryFocus,
  publishedAt,
  "updatedAt": _updatedAt
}`;

export async function getPublishedPosts(): Promise<PublicBlogPost[]> {
  const client = getClient();
  if (!client) return [];
  return client.fetch<PublicBlogPost[]>(
    `*[_type == "post" && status == "published"] | order(publishedAt desc) ${POST_PROJECTION}`,
    {},
    { next: { revalidate: 300 } },
  );
}

export async function getPublishedPostBySlug(
  slug: string,
): Promise<PublicBlogPost | null> {
  const client = getClient();
  if (!client) return null;
  const post = await client.fetch<PublicBlogPost | null>(
    `*[_type == "post" && status == "published" && slug == $slug][0] ${POST_PROJECTION}`,
    { slug },
    { next: { revalidate: 300 } },
  );
  return post ?? null;
}

export async function getPublishedSlugs(): Promise<
  { slug: string; updatedAt: string }[]
> {
  const client = getClient();
  if (!client) return [];
  return client.fetch<{ slug: string; updatedAt: string }[]>(
    `*[_type == "post" && status == "published"]{ "slug": slug, "updatedAt": _updatedAt }`,
    {},
    { next: { revalidate: 300 } },
  );
}
