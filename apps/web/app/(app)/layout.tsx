import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import '../globals.css';
import Sidebar from '@/components/Sidebar';
import AppHeader from '@/components/AppHeader';
import { AuthGuard } from '@/components/AuthGuard';
import { APP_NAME } from '@/lib/config';
import { MobileSidebarProvider } from '@/contexts/MobileSidebarContext';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: `Dashboard | ${APP_NAME}`,
  description: `${APP_NAME} — payroll, made for Africa`,
};

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background`}
    >
      <AuthGuard>
        <MobileSidebarProvider>
          <Sidebar />
          <div className="lg:pl-64">
            <AppHeader />
            <main className="py-6">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {children}
              </div>
            </main>
          </div>
        </MobileSidebarProvider>
      </AuthGuard>
    </div>
  );
}
