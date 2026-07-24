'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Role } from '@repo/api';
import { cn } from '@/lib/utils';
import { useBranding } from '@/contexts/BrandingContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  Calculator,
  Calendar,
  BarChart3,
  UserCircle,
  FileCheck,
  Building,
  CreditCard,
  Settings,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Employees', href: '/employees', icon: Users },
  { name: 'Payroll', href: '/payroll', icon: Calculator },
  { name: 'Leave Management', href: '/leave', icon: Calendar },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Employee Portal', href: '/employee-portal', icon: UserCircle },
  { name: 'Compliance', href: '/compliance', icon: FileCheck },
  // Billing and Settings are ADMIN-only server- and UI-gated; hide the
  // links themselves too so non-admins don't see a permission-denied page.
  { name: 'Billing', href: '/billing', icon: CreditCard, roles: [Role.ADMIN] },
  { name: 'Settings', href: '/settings', icon: Settings, roles: [Role.ADMIN] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const branding = useBranding();
  const { user } = useAuth();
  const visibleNavigation = navigation.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  );

  return (
    <div className="flex h-full w-64 flex-col fixed inset-y-0 z-50 bg-white border-r border-gray-200">
      <div className="flex items-center h-16 px-6 border-b border-gray-200">
        <div className="flex items-center gap-2">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logoUrl}
              alt={branding.appName}
              className="h-8 w-8 object-contain"
            />
          ) : (
            <Building
              className="h-8 w-8"
              style={{ color: branding.primaryColor ?? undefined }}
            />
          )}
          <span className="text-xl font-bold text-gray-900">
            {branding.appName}
          </span>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2">
        {visibleNavigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
