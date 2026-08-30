'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { MobileMenu } from './MobileMenu';
import { Button } from '@/components/ui/button';
import { ModeToggle } from '@/components/Mode-Toggle';
import { Logo } from '@/components/Logo';
import { useBranding } from '@/contexts/BrandingContext';

function Header() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const branding = useBranding();


    return (
        <header className="border-b-2 border-border bg-background sticky top-0 z-50">
            <div className="container mx-auto px-4 py-4">
                <div className="flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        {branding.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={branding.logoUrl}
                                alt={branding.appName}
                                className="h-8 w-8 object-contain"
                            />
                        ) : (
                            <Logo
                                className="h-8 w-8"
                                color={branding.primaryColor ?? undefined}
                            />
                        )}
                        <span className="text-xl font-extrabold">{branding.appName}</span>
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden lg:flex items-center space-x-10">
                        <Link
                            href="/features"
                            className="font-bold text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Features
                        </Link>
                        <Link
                            href="/pricing"
                            className="font-bold text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Pricing
                        </Link>
                        <Link
                            href="/reviews"
                            className="font-bold text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Reviews
                        </Link>
                        <Link
                            href="/contact"
                            className="font-bold text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Contact
                        </Link>
                    </nav>

                    <div className="flex items-center space-x-3">
                        <ModeToggle />

                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="lg:hidden p-2 rounded-md border-2 border-border hover:bg-accent transition-colors"
                            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                        >
                            {mobileMenuOpen ? (
                                <X className="h-5 w-5" />
                            ) : (
                                <Menu className="h-5 w-5" />
                            )}
                        </button>

                        <Button asChild className="hidden lg:inline-flex">
                            <Link href="/signup">Try It Free</Link>
                        </Button>
                    </div>
                </div>

                {/* Mobile Menu */}
                {mobileMenuOpen && (
                    <MobileMenu onNavigate={() => setMobileMenuOpen(false)} />
                )}
            </div>
        </header>
    )
}

export default Header;