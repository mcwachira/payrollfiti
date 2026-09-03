import type { PropsWithChildren } from 'react';
import Header from '@/components/home/Header';
import Footer from '@/components/home/Footer';

export default function AuthLayout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
