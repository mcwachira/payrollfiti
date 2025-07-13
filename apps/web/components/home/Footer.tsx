import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Facebook,
  Twitter,
  Linkedin,
  Instagram,
  Mail,
  Phone,
  MapPin,
  Globe,
} from 'lucide-react';
import Link from 'next/link';
const Footer = () => {
  return (
    <footer className="bg-muted/50 border-t">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div>
            <h3 className="text-xl font-bold text-foreground mb-4">
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
            <h4 className="font-semibold text-foreground mb-4">Product</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <Link href="#" className="hover:text-primary transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-primary transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-primary transition-colors">
                  Integrations
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-primary transition-colors">
                  API
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-primary transition-colors">
                  Security
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Support</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <Link href="#" className="hover:text-primary transition-colors">
                  Help Center
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-primary transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-primary transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-primary transition-colors">
                  Community
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-primary transition-colors">
                  Status
                </Link>
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Stay Updated</h4>
            <p className="text-muted-foreground mb-4 text-sm">
              Get the latest news and updates from PayFlow Africa.
            </p>

            <div className="flex gap-2 mb-4">
              <Input placeholder="Enter your email" className="flex-1" />
              <Button size="sm">Subscribe</Button>
            </div>

            {/* Language/Country Selector */}
            <div className="flex gap-2 mb-4">
              <Button variant="outline" size="sm" className="flex-1">
                <Globe className="h-4 w-4 mr-2" />
                English
              </Button>
              <Button variant="outline" size="sm" className="flex-1">
                Kenya
              </Button>
            </div>
          </div>
        </div>

        <Separator className="my-8" />

        {/* Bottom Section */}
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="text-sm text-muted-foreground mb-4 md:mb-0">
            © 2024 PayFlow Africa. All rights reserved.
          </div>

          <div className="flex items-center space-x-6">
            {/* Legal Links */}
            <div className="flex space-x-4 text-sm text-muted-foreground">
              <Link href="#" className="hover:text-primary transition-colors">
                Privacy Policy
              </Link>
              <Link href="#" className="hover:text-primary transition-colors">
                Terms of Service
              </Link>
              <Link href="#" className="hover:text-primary transition-colors">
                Cookie Policy
              </Link>
            </div>

            {/* Social Media */}
            <div className="flex space-x-3">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Facebook className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Twitter className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Linkedin className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Instagram className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
