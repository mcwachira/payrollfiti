import { PropsWithChildren } from 'react';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';

import './globals.css';
import { APP_NAME, SITE_URL } from '@/lib/config';
import { AuthProvider } from '@/contexts/AuthContext';
import { BrandingProvider } from '@/contexts/BrandingContext';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/components/theme-provider';
import { QueryProvider } from '@/components/query-provider';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';

const inter = Inter({ subsets: ['latin'] });

const DEFAULT_DESCRIPTION =
  'Payroll and statutory compliance software for Kenya, Nigeria, and South Africa. Automate PAYE, NSSF, SHIF, and payslips in minutes.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${APP_NAME} — Payroll & Compliance Software for Africa`,
    template: `%s | ${APP_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  keywords: [
    'payroll software Kenya',
    'PAYE calculator Kenya',
    'NSSF SHIF payroll',
    'Nigeria payroll software',
    'South Africa payroll software',
    'statutory compliance software Africa',
  ],
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: APP_NAME,
  },
  icons: {
    apple: '/icons/apple-touch-icon.png',
  },
  openGraph: {
    type: 'website',
    siteName: APP_NAME,
    title: `${APP_NAME} — Payroll & Compliance Software for Africa`,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${APP_NAME} — Payroll & Compliance Software for Africa`,
    description: DEFAULT_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#e11d48',
};

export default function RootLayout({ children }: Readonly<PropsWithChildren>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <AuthProvider>
              <BrandingProvider>{children}</BrandingProvider>
            </AuthProvider>
            <Toaster />
            <InstallPrompt />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
