"use client"
import Link from 'next/link';
import { Button } from "@/components/ui/button"

export function MobileMenu({onNavigate}:{onNavigate?:()=>void}) {
  return (

    <div className="lg:hidden mt-4 pb-4 border-2-2 border-border">

      <nav className="flex flex-col space-y-2 mt-4">
        <Link
        href="/features"
        onClick={onNavigate}
        className="py-2 font-bold hover:text-primary transition-colors "
        >
            Features
        </Link>
        <Link
          href="/pricing"
          onClick={onNavigate}
          className="py-2 font-bold hover:text-primary transition-colors"
        >
          Pricing
        </Link>
        <Link
          href="/reviews"
          onClick={onNavigate}
          className="py-2 font-bold hover:text-primary transition-colors"
        >
          Reviews
        </Link>
        <Link
          href="/contact"
          onClick={onNavigate}
          className="py-2 font-bold hover:text-primary transition-colors"
        >
          Contact
        </Link>
        <Button asChild className="mt-4 w-full">
          <Link href="/signup" onClick={onNavigate}>
            Try It Free
          </Link>
        </Button>
      </nav>
    </div>
  );
}
