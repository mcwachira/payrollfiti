import { apiFetch } from './api-client';

export const BLOG_COUNTRY_FOCUS = ['KE', 'NG', 'ZA', 'GENERAL'] as const;
export type BlogCountryFocus = (typeof BLOG_COUNTRY_FOCUS)[number];

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverImageUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  countryFocus: BlogCountryFocus;
  status: 'draft' | 'published';
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BlogPostInput {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverImageUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  countryFocus: BlogCountryFocus;
}

export function getBlogStatus(): Promise<{ configured: boolean }> {
  return apiFetch<{ configured: boolean }>('/blog-posts/status');
}

export function listBlogPosts(): Promise<BlogPost[]> {
  return apiFetch<BlogPost[]>('/blog-posts');
}

export function getBlogPost(id: string): Promise<BlogPost> {
  return apiFetch<BlogPost>(`/blog-posts/${id}`);
}

export function createBlogPost(input: BlogPostInput): Promise<BlogPost> {
  return apiFetch<BlogPost>('/blog-posts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateBlogPost(
  id: string,
  input: Partial<BlogPostInput>,
): Promise<BlogPost> {
  return apiFetch<BlogPost>(`/blog-posts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function publishBlogPost(id: string): Promise<BlogPost> {
  return apiFetch<BlogPost>(`/blog-posts/${id}/publish`, { method: 'POST' });
}

export function unpublishBlogPost(id: string): Promise<BlogPost> {
  return apiFetch<BlogPost>(`/blog-posts/${id}/unpublish`, { method: 'POST' });
}

export function deleteBlogPost(id: string): Promise<void> {
  return apiFetch<void>(`/blog-posts/${id}`, { method: 'DELETE' });
}
