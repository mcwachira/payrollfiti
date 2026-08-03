'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Newspaper, Plus, ExternalLink } from 'lucide-react';
import { Role } from '@repo/api';
import { RoleGuard } from '@/components/RoleGuard';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { PageSkeleton } from '@/components/ui/loading-skeleton';
import {
  getBlogStatus,
  listBlogPosts,
  createBlogPost,
  updateBlogPost,
  publishBlogPost,
  unpublishBlogPost,
  deleteBlogPost,
  BLOG_COUNTRY_FOCUS,
  type BlogPost,
  type BlogPostInput,
  type BlogCountryFocus,
} from '@/lib/blog-api';
import { ApiError } from '@/lib/api-client';

const COUNTRY_LABELS: Record<BlogCountryFocus, string> = {
  KE: 'Kenya',
  NG: 'Nigeria',
  ZA: 'South Africa',
  GENERAL: 'General',
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const emptyForm: BlogPostInput = {
  title: '',
  slug: '',
  excerpt: '',
  body: '',
  coverImageUrl: '',
  seoTitle: '',
  seoDescription: '',
  countryFocus: 'GENERAL',
};

function PostFormDialog({
  post,
  trigger,
}: {
  post?: BlogPost;
  trigger: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [slugTouched, setSlugTouched] = useState(!!post);
  const [form, setForm] = useState<BlogPostInput>(
    post
      ? {
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          body: post.body,
          coverImageUrl: post.coverImageUrl ?? '',
          seoTitle: post.seoTitle ?? '',
          seoDescription: post.seoDescription ?? '',
          countryFocus: post.countryFocus,
        }
      : emptyForm,
  );

  const isValid =
    form.title.trim() &&
    form.slug.trim() &&
    form.excerpt.trim() &&
    form.body.trim();

  const saveMutation = useMutation({
    mutationFn: () =>
      post ? updateBlogPost(post.id, form) : createBlogPost(form),
    onSuccess: () => {
      toast.success(post ? 'Post updated' : 'Post created as a draft');
      queryClient.invalidateQueries({ queryKey: ['blog-posts'] });
      setOpen(false);
    },
    onError: (error) => {
      toast.error('Could not save this post', {
        description: errorMessage(error, 'Please try again'),
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{post ? 'Edit post' : 'New post'}</DialogTitle>
          <DialogDescription>
            {post
              ? 'Changes save as a draft update — publish separately from the list.'
              : 'Saved as a draft first — publish it once it looks right.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="post-title">Title</Label>
            <Input
              id="post-title"
              value={form.title}
              onChange={(e) => {
                const title = e.target.value;
                setForm((f) => ({
                  ...f,
                  title,
                  slug: slugTouched ? f.slug : slugify(title),
                }));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="post-slug">Slug</Label>
            <Input
              id="post-slug"
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                setForm((f) => ({ ...f, slug: slugify(e.target.value) }));
              }}
            />
            <p className="text-xs text-muted-foreground">
              /blog/{form.slug || '…'}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="post-country">Country focus</Label>
            <Select
              value={form.countryFocus}
              onValueChange={(value: BlogCountryFocus) =>
                setForm((f) => ({ ...f, countryFocus: value }))
              }
            >
              <SelectTrigger id="post-country">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BLOG_COUNTRY_FOCUS.map((code) => (
                  <SelectItem key={code} value={code}>
                    {COUNTRY_LABELS[code]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="post-excerpt">Excerpt</Label>
            <Textarea
              id="post-excerpt"
              rows={2}
              value={form.excerpt}
              onChange={(e) =>
                setForm((f) => ({ ...f, excerpt: e.target.value }))
              }
              placeholder="One or two sentences shown on the blog listing"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="post-body">Body (Markdown)</Label>
            <Textarea
              id="post-body"
              rows={12}
              className="font-mono text-sm"
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="post-cover">Cover image URL (optional)</Label>
            <Input
              id="post-cover"
              value={form.coverImageUrl}
              onChange={(e) =>
                setForm((f) => ({ ...f, coverImageUrl: e.target.value }))
              }
              placeholder="https://…"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="post-seo-title">SEO title (optional)</Label>
              <Input
                id="post-seo-title"
                maxLength={70}
                value={form.seoTitle}
                onChange={(e) =>
                  setForm((f) => ({ ...f, seoTitle: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="post-seo-description">
                SEO description (optional)
              </Label>
              <Input
                id="post-seo-description"
                maxLength={160}
                value={form.seoDescription}
                onChange={(e) =>
                  setForm((f) => ({ ...f, seoDescription: e.target.value }))
                }
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!isValid || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending
              ? 'Saving…'
              : post
                ? 'Save changes'
                : 'Create draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PostRow({ post }: { post: BlogPost }) {
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['blog-posts'] });

  const publishMutation = useMutation({
    mutationFn: () => publishBlogPost(post.id),
    onSuccess: () => {
      toast.success('Post published');
      invalidate();
    },
    onError: (error) =>
      toast.error('Could not publish', {
        description: errorMessage(error, 'Please try again'),
      }),
  });

  const unpublishMutation = useMutation({
    mutationFn: () => unpublishBlogPost(post.id),
    onSuccess: () => {
      toast.success('Post unpublished');
      invalidate();
    },
    onError: (error) =>
      toast.error('Could not unpublish', {
        description: errorMessage(error, 'Please try again'),
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteBlogPost(post.id),
    onSuccess: () => {
      toast.success('Post deleted');
      invalidate();
    },
    onError: (error) =>
      toast.error('Could not delete', {
        description: errorMessage(error, 'Please try again'),
      }),
  });

  return (
    <TableRow>
      <TableCell className="font-medium max-w-xs truncate">
        {post.title}
      </TableCell>
      <TableCell>{COUNTRY_LABELS[post.countryFocus]}</TableCell>
      <TableCell>
        {post.status === 'published' ? (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400">
            Published
          </Badge>
        ) : (
          <Badge variant="outline">Draft</Badge>
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {post.publishedAt
          ? new Date(post.publishedAt).toLocaleDateString()
          : '—'}
      </TableCell>
      <TableCell className="text-right space-x-2 whitespace-nowrap">
        {post.status === 'published' && (
          <Button variant="ghost" size="sm" asChild>
            <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        )}
        <PostFormDialog
          post={post}
          trigger={
            <Button variant="outline" size="sm">
              Edit
            </Button>
          }
        />
        {post.status === 'published' ? (
          <Button
            variant="outline"
            size="sm"
            disabled={unpublishMutation.isPending}
            onClick={() => unpublishMutation.mutate()}
          >
            Unpublish
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={publishMutation.isPending}
            onClick={() => publishMutation.mutate()}
          >
            Publish
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm">
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete &quot;{post.title}&quot;?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This removes it from Sanity entirely, published or not. This
                can&apos;t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteMutation.mutate()}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  );
}

function BlogAdminContent() {
  const statusQuery = useQuery({
    queryKey: ['blog-status'],
    queryFn: getBlogStatus,
  });

  const postsQuery = useQuery({
    queryKey: ['blog-posts'],
    queryFn: listBlogPosts,
    enabled: statusQuery.data?.configured === true,
  });

  if (statusQuery.isPending) {
    return <PageSkeleton cards={1} rows={6} />;
  }

  if (!statusQuery.data?.configured) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold">Blog</h1>
          <p className="text-muted-foreground">
            Write and publish posts to the public /blog pages
          </p>
        </div>
        <Card>
          <CardContent className="pt-6 flex flex-col items-center text-center py-12 gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 border-2 border-border flex items-center justify-center">
              <Newspaper className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="font-bold mb-1">Sanity isn&apos;t connected yet</p>
              <p className="text-sm text-muted-foreground max-w-md">
                Set SANITY_PROJECT_ID, SANITY_DATASET, and SANITY_API_TOKEN on
                the API — see the build guide&apos;s blog/Sanity setup part for
                the step-by-step walkthrough.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Blog</h1>
          <p className="text-muted-foreground">
            Write and publish posts to the public /blog pages
          </p>
        </div>
        <PostFormDialog
          trigger={
            <Button>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New post
            </Button>
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{postsQuery.data?.length ?? 0} posts</CardTitle>
          <CardDescription>
            Drafts and published posts, newest first
          </CardDescription>
        </CardHeader>
        <CardContent>
          {postsQuery.isPending ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : postsQuery.error ? (
            <p className="text-sm text-red-600 dark:text-red-400">
              {errorMessage(postsQuery.error, 'Failed to load posts')}
            </p>
          ) : (postsQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No posts yet — create your first one
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(postsQuery.data ?? []).map((post) => (
                  <PostRow key={post.id} post={post} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function BlogAdminPage() {
  return (
    <RoleGuard allow={[Role.ADMIN]}>
      <BlogAdminContent />
    </RoleGuard>
  );
}
