'use client';

import Link from 'next/link';
import { useState } from 'react';
// import { ThemeToggle } from '../theme/ThemeToggle';
import { FileText, Menu, X } from 'lucide-react';
import { MobileMenu } from './MobileMenu';
// import Logo from '../Logo';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="border-b border-b-black bg-gradient-to-br from-blue-50 via-green-50 to-orange-50 backdrop-blur-md sticky top-0 z-50">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-green-600/5" />
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* <Logo /> */}

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-10">
            <Link
              href="#features"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </Link>
            <Link
              href="#pricing"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="#testimonials"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Reviews
            </Link>
            <Link
              href="#contact"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Contact
            </Link>
          </nav>

          <div className="flex items-center space-x-4">
            {/* Dark Mode Toggle */}
            {/* <ThemeToggle /> */}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-md hover:bg-accent transition-colors"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>

            <button className="hidden md:block bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors">
              Try It Free
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && <MobileMenu />}
      </div>
    </header>
  );
}
