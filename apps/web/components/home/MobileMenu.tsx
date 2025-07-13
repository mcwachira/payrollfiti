'use client';

import Link from 'next/link';

export function MobileMenu() {
  return (
    <div className="lg:hidden mt-4 pb-4 border-t border-border">
      <nav className="flex flex-col space-y-2 mt-4">
        <Link
          href="#features"
          className="py-2 hover:text-primary transition-colors"
        >
          Features
        </Link>
        <Link
          href="#pricing"
          className="py-2 hover:text-primary transition-colors"
        >
          Pricing
        </Link>
        <Link
          href="#testimonials"
          className="py-2 hover:text-primary transition-colors"
        >
          Reviews
        </Link>
        <Link
          href="#contact"
          className="py-2 hover:text-primary transition-colors"
        >
          Contact
        </Link>
        <button className="mt-4 bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90 transition-colors w-full">
          Try It Free
        </button>
      </nav>
    </div>
  );
}
