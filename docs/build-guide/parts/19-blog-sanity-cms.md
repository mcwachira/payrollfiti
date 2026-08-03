# Part 19 — The Blog: Sanity CMS, a Custom Dashboard, and SEO

The footer has linked to `/blog` since Part 1, and it's been a "coming soon" placeholder the entire time. This part builds the real thing — but not the obvious way. The usual Sanity integration means editors log into Sanity Studio, a separate app with its own URL, to write content. Here the write path is `/blog-admin`, a page inside this app's own authenticated dashboard, right next to Audit Log and Settings — Sanity is the storage engine underneath, never a UI anyone has to context-switch into.

## 19.1 Why a Headless Store, Not a Studio

Sanity's Content Lake is schemaless at the API level — Studio's schema definitions exist purely to give Studio's own editing UI something to render fields against. Skip Studio entirely, and there's no schema to define anywhere: whatever shape a client writes with `_type: 'post'` *is* the schema, enforced only by whatever code reads it back. That code is this codebase's own TypeScript types, in exactly one place:

```typescript
// api/src/blog/blog.service.ts
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
```

`body` is plain Markdown text, not Sanity's Portable Text rich-text format — Portable Text needs its own renderer on the frontend and its own editing widget on the backend; a `<textarea>` and `marked.parse()` (Part 19.4) do the same job with zero extra moving parts, at the cost of a slightly less polished editing experience. `coverImageUrl` is a plain external URL string rather than Sanity's binary asset pipeline, for the same reason — there's no Studio asset uploader to feed it from anyway.

## 19.2 The Trust Boundary — Two Clients, One Project

Every Sanity document is either mutated by someone holding a scoped API token, or read by anyone who knows the project ID — there's no in-between. That maps directly onto the two audiences this feature has, and onto this codebase's standing rule that a write-capable third-party credential lives on the server, never the browser:

```typescript
// api/src/blog/blog.service.ts
/**
 * Owns all write access to the blog's Sanity project — the admin
 * dashboard's only path to Sanity, using a write-scoped API token that
 * never reaches the browser. The public /blog pages read Sanity directly
 * with their own token-less, CDN-backed client instead — this service has
 * nothing to do with public reads.
 */
@Injectable()
export class BlogService {
  private readonly client: SanityClient | null;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    const config = this.configService.get('sanity', { infer: true });
    this.client = config.projectId && config.apiToken
      ? createClient({
          projectId: config.projectId,
          dataset: config.dataset,
          apiVersion: '2024-01-01',
          token: config.apiToken,
          useCdn: false, // writes need to see their own just-written state immediately
        })
      : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }
}
```

```typescript
// web/lib/sanity-client.ts
/**
 * Public, token-less client — reads only `status == "published"` posts via
 * Sanity's CDN-backed API. This client can't write anything even if it
 * wanted to, since it was never given a token.
 */
function getClient() {
  if (!SANITY_PROJECT_ID) return null;
  return createClient({
    projectId: SANITY_PROJECT_ID,
    dataset: SANITY_DATASET,
    apiVersion: '2024-01-01',
    useCdn: true,
  });
}
```

Both clients degrade the same way every other optional integration in this codebase does — config-gated, not required. `isConfigured()` on the backend feeds `GET /blog-posts/status`, which `/blog-admin` checks before rendering the CRUD table at all; the frontend's `getClient()` returning `null` makes every public read function return an empty result instead of throwing, so `/blog` renders its pre-existing "coming soon" empty state rather than erroring when Sanity isn't set up yet (§19.5 covers actually setting it up).

Slugs need to be unique, and Sanity has no unique-field constraint to lean on — enforced with a GROQ query, parameterized (never string-interpolated) since the slug is user-supplied:

```typescript
// api/src/blog/blog.service.ts
private async assertSlugAvailable(client: SanityClient, slug: string, excludeId?: string): Promise<void> {
  const existing = await client.fetch<{ _id: string } | null>(
    `*[_type == $type && slug == $slug && _id != $excludeId][0]{ _id }`,
    { type: DOCUMENT_TYPE, slug, excludeId: excludeId ?? '' },
  );
  if (existing) {
    throw new ConflictException(`A post with slug "${slug}" already exists`);
  }
}
```

## 19.3 The Admin Dashboard

`GET /blog-posts` and friends are gated the same way Audit Log's endpoints are — `@Roles(ADMIN)` plus a dedicated `Permission.BLOG_MANAGE`, added to `ADMIN_ONLY_PERMISSIONS` so `HR` doesn't inherit it automatically the way it inherits everything not explicitly excluded:

```typescript
// api/src/blog/blog.controller.ts
@Controller('blog-posts')
@Roles(Role.ADMIN)
@RequirePermission(Permission.BLOG_MANAGE)
export class BlogController {
  @Get('status')
  status() {
    return { configured: this.blogService.isConfigured() };
  }
  // create, list, get, update, publish, unpublish, remove — one route each
}
```

`/blog-admin` is a single page: a status check, a table of every post (draft and published both — this is the dashboard, not the public listing), and a shared create/edit dialog. The slug field auto-derives from the title but stays editable, and stops auto-deriving the moment someone touches it directly:

```typescript
// web/app/(app)/blog-admin/page.tsx
<Input
  id="post-title"
  value={form.title}
  onChange={(e) => {
    const title = e.target.value;
    setForm((f) => ({
      ...f,
      title,
      slug: slugTouched ? f.slug : slugify(title), // stops once the slug field itself is edited
    }));
  }}
/>
```

Publishing is a separate action from saving — `POST /blog-posts/:id/publish` sets `status` and stamps `publishedAt`; `unpublish` clears both — so a half-finished draft never accidentally goes live just because someone clicked "save":

```typescript
// api/src/blog/blog.service.ts
async publish(id: string): Promise<BlogPost> {
  const client = this.requireClient();
  await this.get(id);
  const updated = await client
    .patch(id)
    .set({ status: 'published', publishedAt: new Date().toISOString() })
    .commit<PostFields>();
  return toBlogPost(updated);
}
```

## 19.4 The Public Blog — SSG, ISR, and Structured Data

`/blog` and `/blog/[slug]` are server components that call the public client directly and render at request time, cached and revalidated every 5 minutes (`export const revalidate = 300`) — fast enough that a newly-published post shows up without a redeploy, cached enough that Sanity isn't hit on every single page view:

```typescript
// web/app/(marketing)/blog/[slug]/page.tsx
export async function generateStaticParams() {
  const slugs = await getPublishedSlugs();
  return slugs.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) return {};
  return {
    title: post.seoTitle || post.title,
    description: post.seoDescription || post.excerpt,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: { type: 'article', publishedTime: post.publishedAt, /* ... */ },
  };
}
```

`seoTitle`/`seoDescription` fall back to `title`/`excerpt` when an editor leaves them blank — every post gets real metadata even if nobody filled in the SEO-specific fields. Markdown renders via `marked`, the one new dependency this feature needed on the frontend:

```typescript
// web/app/(marketing)/blog/[slug]/page.tsx
const bodyHtml = await marked.parse(post.body);
// ...
<div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
```

`prose`/`dark:prose-invert` come from `@tailwindcss/typography` (added via `@plugin '@tailwindcss/typography';` in `globals.css` — Tailwind v4's CSS-based plugin registration, no `tailwind.config.js` needed) — real heading/list/code-block typography for free, rather than hand-writing it.

Each post gets `Article` JSON-LD (Part 15's pattern, same `<JsonLd>` component) and its own dynamic Open Graph image — a per-route `opengraph-image.tsx` overriding the site-wide default from Part 15, rendered with the post's actual title:

```typescript
// web/app/(marketing)/blog/[slug]/opengraph-image.tsx
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  const title = post?.title ?? APP_NAME;
  return new ImageResponse(/* branded card with the real post title */, { ...size });
}
```

`app/sitemap.ts` (Part 15) pulls every published slug alongside the static marketing routes, so a new post is discoverable the same build/revalidation cycle it's published in:

```typescript
// web/app/sitemap.ts
const posts = await getPublishedSlugs();
const postEntries = posts.map(({ slug, updatedAt }) => ({
  url: `${SITE_URL}/blog/${slug}`,
  lastModified: new Date(updatedAt),
  changeFrequency: 'monthly' as const,
  priority: 0.7,
}));
```

## 19.5 One-Time Setup — Creating the Sanity Project

Everything above already works against a real Sanity project — this is the one-time step to make one exist. No Sanity Studio deployment is part of this; the CLI command below only provisions the project itself.

1. **Create a free Sanity account** at sanity.io if you don't have one.
2. **Provision a project.** From the repo root: `npx sanity@latest init` — pick "Create new project", give it a name, accept the default dataset name (`production`). This prints a **Project ID**; note it down. (If you'd rather not run the CLI, sanity.io/manage → "Create project" gives you the same ID.)
3. **Generate an API token.** In sanity.io/manage, open the project → API → Tokens → "Add API token". Name it (e.g. "PayrollFiti backend"), give it **Editor** permissions (read + write), and copy the token — Sanity only shows it once.
4. **Set the environment variables** — four total, split by which app reads them:

   ```bash
   # apps/api's .env — write access, server-side only
   SANITY_PROJECT_ID=<the project ID from step 2>
   SANITY_DATASET=production
   SANITY_API_TOKEN=<the token from step 3>

   # apps/web's .env — public, read-only, safe to expose to the browser
   NEXT_PUBLIC_SANITY_PROJECT_ID=<the same project ID>
   NEXT_PUBLIC_SANITY_DATASET=production
   ```

5. **Restart both apps.** `GET /blog-posts/status` should now report `{ "configured": true }`, `/blog-admin` shows the real dashboard instead of the "Sanity isn't connected yet" card, and `/blog` will start rendering real posts the moment the first one is published.

From here on, day-to-day blogging never touches Sanity's own UI — write, save, and publish posts entirely from `/blog-admin`, the same place every other piece of this app's content lives.
