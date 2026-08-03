import { ImageResponse } from 'next/og';
import { APP_NAME } from '@/lib/config';
import { getPublishedPostBySlug } from '@/lib/sanity-client';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const COUNTRY_LABELS: Record<string, string> = {
  KE: 'Kenya',
  NG: 'Nigeria',
  ZA: 'South Africa',
  GENERAL: 'PayrollFiti',
};

// Overrides the root app/opengraph-image.tsx for this route — same
// mechanism, per-post title instead of the generic default.
export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  const title = post?.title ?? APP_NAME;
  const country = post ? (COUNTRY_LABELS[post.countryFocus] ?? '') : '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '80px',
          backgroundColor: '#1c1917',
          color: '#fafaf9',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 10,
              backgroundColor: '#e11d48',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
              fontWeight: 800,
            }}
          >
            P
          </div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{APP_NAME} Blog</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {country && (
            <div
              style={{
                display: 'flex',
                fontSize: 22,
                fontWeight: 700,
                width: 'fit-content',
                padding: '6px 18px',
                borderRadius: 999,
                border: '2px solid #e11d48',
                color: '#fda4af',
              }}
            >
              {country}
            </div>
          )}
          <div
            style={{
              fontSize: 52,
              fontWeight: 800,
              lineHeight: 1.2,
              maxWidth: 1000,
            }}
          >
            {title}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
