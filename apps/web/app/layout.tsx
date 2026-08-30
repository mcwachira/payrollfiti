import { Geist, Geist_Mono, JetBrains_Mono } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils";
import { Metadata } from "next"
import { APP_NAME, SITE_URL } from '@/lib/config';

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
})

const jetbrainsMono = JetBrains_Mono({subsets:['latin'],variable:'--font-mono'})

const DEFAULT_DESCRIPTION =
  'Payroll and statutory compliance software built for Africa — live in Kenya, Nigeria, and South Africa today, with more African countries on the roadmap. Automate PAYE, NSSF, SHIF, and payslips in minutes.';

export const metadata:Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${APP_NAME} — Payroll & Compliance Software for Africa`,
    template: `%s | ${APP_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  keywords: [
    'payroll software Africa',
    'pan-African payroll software',
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
}
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontSans.variable, "font-mono", jetbrainsMono.variable)}
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
