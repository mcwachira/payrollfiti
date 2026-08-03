import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SanityClient } from '@sanity/client';
import { AppConfig } from '../config/configuration';
import { CreateBlogPostDto } from './dto/create-blog-post.dto';
import { UpdateBlogPostDto } from './dto/update-blog-post.dto';

const DOCUMENT_TYPE = 'post';
const API_VERSION = '2024-01-01';

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverImageUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  countryFocus: string;
  status: 'draft' | 'published';
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface PostFields {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverImageUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  countryFocus: string;
  status: 'draft' | 'published';
  publishedAt?: string;
}

interface SanityPostDocument extends PostFields {
  _id: string;
  _type: string;
  _createdAt: string;
  _updatedAt: string;
}

function toBlogPost(doc: SanityPostDocument): BlogPost {
  return {
    id: doc._id,
    title: doc.title,
    slug: doc.slug,
    excerpt: doc.excerpt,
    body: doc.body,
    coverImageUrl: doc.coverImageUrl,
    seoTitle: doc.seoTitle,
    seoDescription: doc.seoDescription,
    countryFocus: doc.countryFocus,
    status: doc.status,
    publishedAt: doc.publishedAt,
    createdAt: doc._createdAt,
    updatedAt: doc._updatedAt,
  };
}

/**
 * Owns all write access to the blog's Sanity project — the admin
 * dashboard's only path to Sanity, using a write-scoped API token that
 * never reaches the browser. The public /blog pages read Sanity directly
 * with their own token-less, CDN-backed client instead (see
 * apps/web/lib/sanity-client.ts) — this service has nothing to do with
 * public reads.
 *
 * No Sanity Studio schema exists or is required: Sanity's Content Lake is
 * schemaless at the API level, so this service's own TypeScript types
 * (above) are the only "schema" this document type has, and the shape it
 * writes is the shape the dashboard and public site both read back.
 */
@Injectable()
export class BlogService {
  private readonly client: SanityClient | null;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    const config = this.configService.get('sanity', { infer: true });
    this.client =
      config.projectId && config.apiToken
        ? createClient({
            projectId: config.projectId,
            dataset: config.dataset,
            apiVersion: API_VERSION,
            token: config.apiToken,
            // Writes need to see their own just-written state immediately
            // (e.g. publish() -> re-render the dashboard row) — the CDN
            // cache the public site relies on would serve stale data here.
            useCdn: false,
          })
        : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  private requireClient(): SanityClient {
    if (!this.client) {
      throw new BadRequestException(
        'Sanity is not configured on this server — set SANITY_PROJECT_ID and SANITY_API_TOKEN first.',
      );
    }
    return this.client;
  }

  private async assertSlugAvailable(
    client: SanityClient,
    slug: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await client.fetch<{ _id: string } | null>(
      `*[_type == $type && slug == $slug && _id != $excludeId][0]{ _id }`,
      { type: DOCUMENT_TYPE, slug, excludeId: excludeId ?? '' },
    );
    if (existing) {
      throw new ConflictException(`A post with slug "${slug}" already exists`);
    }
  }

  async list(): Promise<BlogPost[]> {
    const client = this.requireClient();
    const docs = await client.fetch<SanityPostDocument[]>(
      `*[_type == $type] | order(_createdAt desc)`,
      { type: DOCUMENT_TYPE },
    );
    return docs.map(toBlogPost);
  }

  async get(id: string): Promise<BlogPost> {
    const client = this.requireClient();
    const doc = await client.getDocument<SanityPostDocument>(id);
    if (!doc || doc._type !== DOCUMENT_TYPE) {
      throw new NotFoundException('Blog post not found');
    }
    return toBlogPost(doc);
  }

  async create(dto: CreateBlogPostDto): Promise<BlogPost> {
    const client = this.requireClient();
    await this.assertSlugAvailable(client, dto.slug);

    const created = await client.create<PostFields>({
      _type: DOCUMENT_TYPE,
      title: dto.title,
      slug: dto.slug,
      excerpt: dto.excerpt,
      body: dto.body,
      coverImageUrl: dto.coverImageUrl,
      seoTitle: dto.seoTitle,
      seoDescription: dto.seoDescription,
      countryFocus: dto.countryFocus,
      status: 'draft',
    });
    return toBlogPost(created);
  }

  async update(id: string, dto: UpdateBlogPostDto): Promise<BlogPost> {
    const client = this.requireClient();
    await this.get(id); // 404s before touching Sanity if the id is wrong
    if (dto.slug) {
      await this.assertSlugAvailable(client, dto.slug, id);
    }

    const updated = await client
      .patch(id)
      .set({ ...dto })
      .commit<PostFields>();
    return toBlogPost(updated);
  }

  async publish(id: string): Promise<BlogPost> {
    const client = this.requireClient();
    await this.get(id);
    const updated = await client
      .patch(id)
      .set({ status: 'published', publishedAt: new Date().toISOString() })
      .commit<PostFields>();
    return toBlogPost(updated);
  }

  async unpublish(id: string): Promise<BlogPost> {
    const client = this.requireClient();
    await this.get(id);
    const updated = await client
      .patch(id)
      .set({ status: 'draft' })
      .unset(['publishedAt'])
      .commit<PostFields>();
    return toBlogPost(updated);
  }

  async remove(id: string): Promise<void> {
    const client = this.requireClient();
    await this.get(id);
    await client.delete(id);
  }
}
