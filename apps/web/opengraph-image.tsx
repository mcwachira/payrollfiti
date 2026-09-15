import { ImageResponse } from 'next/og';
import { APP_NAME } from '@/lib/config';

export const alt = `${APP_NAME} — Payroll & Compliance Software for Africa`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Default OG image for any page that doesn't define its own — a nested
// route can override this by adding its own opengraph-image.tsx (the blog
// post pages at (marketing)/blog/[slug] do exactly that with a per-post
// title).
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          backgroundColor: '#1c1917',
          color: '#fafaf9',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              backgroundColor: '#e11d48',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              fontWeight: 800,
              color: '#fafaf9',
            }}
          >
            P
          </div>
          <div style={{ fontSize: 36, fontWeight: 800 }}>{APP_NAME}</div>
        </div>
        <div
          style={{
            fontSize: 56,
            fontWeight: 800,
            lineHeight: 1.15,
            maxWidth: 920,
          }}
        >
          Payroll & Statutory Compliance for Africa
        </div>
        <div
          style={{
            display: 'flex',
            gap: 12,
            marginTop: 36,
          }}
        >
          {['Kenya', 'Nigeria', 'South Africa'].map((country) => (
            <div
              key={country}
              style={{
                display: 'flex',
                fontSize: 24,
                fontWeight: 700,
                padding: '8px 20px',
                borderRadius: 999,
                border: '2px solid #e11d48',
                color: '#fda4af',
              }}
            >
              {country}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
