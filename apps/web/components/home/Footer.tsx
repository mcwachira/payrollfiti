'use client';

import { useState, type FormEvent } from 'react';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Mail, Phone, MapPin, Globe } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

const LANGUAGES = ['English', 'Kiswahili', 'Français'];
const COUNTRIES = ['Kenya', 'Uganda', 'Nigeria', 'South Africa'];

const Footer = () => {
  const [email, setEmail] = useState('');
  const [language, setLanguage] = useState('English');
  const [country, setCountry] = useState('Kenya');

  const handleSubscribe = (event: FormEvent) => {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast.error('Enter a valid email address');
      return;
    }
    toast.success("You're on the list", {
      description: "We'll email you at " + email + ' with product updates.',
    });
    setEmail('');
  };

  return (
    <footer className="bg-muted/50 border-t-2 border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div>
            <h3 className="text-xl font-extrabold text-foreground mb-4">
              PayFlow Africa
            </h3>
            <p className="text-muted-foreground mb-4">
              Empowering African businesses with modern payroll and HR
              solutions.
            </p>

            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center">
                <MapPin className="h-4 w-4 mr-2" />
                Nairobi, Kenya
              </div>
              <div className="flex items-center">
                <Phone className="h-4 w-4 mr-2" />
                +254 700 123 456
              </div>
              <div className="flex items-center">
                <Mail className="h-4 w-4 mr-2" />
                hello@payflow-africa.com
              </div>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-extrabold text-foreground mb-4">Product</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <Link
                  href="/features"
                  className="hover:text-primary transition-colors"
                >
                  Features
                </Link>
              </li>
              <li>
                <Link
                  href="/pricing"
                  className="hover:text-primary transition-colors"
                >
                  Pricing
                </Link>
              </li>
              <li>
                <Link
                  href="/features"
                  className="hover:text-primary transition-colors"
                >
                  Integrations
                </Link>
              </li>
              <li>
                <Link
                  href="/features"
                  className="hover:text-primary transition-colors"
                >
                  API
                </Link>
              </li>
              <li>
                <Link
                  href="/features"
                  className="hover:text-primary transition-colors"
                >
                  Security
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-extrabold text-foreground mb-4">Support</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <Link
                  href="/help"
                  className="hover:text-primary transition-colors"
                >
                  Help Center
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="hover:text-primary transition-colors"
                >
                  Contact Us
                </Link>
              </li>
              <li>
                <Link
                  href="/blog"
                  className="hover:text-primary transition-colors"
                >
                  Blog
                </Link>
              </li>
              <li>
                <Link
                  href="/community"
                  className="hover:text-primary transition-colors"
                >
                  Community
                </Link>
              </li>
              <li>
                <Link
                  href="/status"
                  className="hover:text-primary transition-colors"
                >
                  Status
                </Link>
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="font-extrabold text-foreground mb-4">
              Stay Updated
            </h4>
            <p className="text-muted-foreground mb-4 text-sm">
              Get the latest news and updates from PayFlow Africa.
            </p>

            <form onSubmit={handleSubscribe} className="flex gap-2 mb-4">
              <Input
                type="email"
                placeholder="Enter your email"
                className="flex-1"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label="Email address"
              />
              <Button size="sm" type="submit">
                Subscribe
              </Button>
            </form>

            {/* Language/Country Selector */}
            <div className="flex gap-2 mb-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1">
                    <Globe className="h-4 w-4 mr-2" />
                    {language}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {LANGUAGES.map((lang) => (
                    <DropdownMenuItem
                      key={lang}
                      onClick={() => {
                        setLanguage(lang);
                        if (lang !== 'English') {
                          toast('More languages coming soon', {
                            description: `${lang} translations are on our roadmap.`,
                          });
                        }
                      }}
                    >
                      {lang}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1">
                    {country}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {COUNTRIES.map((c) => (
                    <DropdownMenuItem key={c} onClick={() => setCountry(c)}>
                      {c}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        <Separator className="my-8" />

        {/* Bottom Section */}
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="text-sm text-muted-foreground mb-4 md:mb-0">
            © {new Date().getFullYear()} PayFlow Africa. All rights reserved.
          </div>

          <div className="flex space-x-4 text-sm text-muted-foreground">
            <Link
              href="/privacy"
              className="hover:text-primary transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="hover:text-primary transition-colors"
            >
              Terms of Service
            </Link>
            <Link
              href="/cookies"
              className="hover:text-primary transition-colors"
            >
              Cookie Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
