'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Role } from '@repo/api';
import { cn } from '@/lib/utils';
import { useBranding } from '@/contexts/BrandingContext';
import { useAuth } from '@/contexts/AuthContext';
import { useMobileSidebar } from '@/contexts/MobileSidebarContext';
import { Logo } from '@/components/Logo';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  LayoutDashboard,
  Users,
  Calculator,
  Calendar,
  BarChart3,
  UserCircle,
  FileCheck,
  CreditCard,
  Settings,
  Wallet,
  History,
  Newspaper,
} from 'lucide-react';

// `roles` mirrors each page's own server-side @Roles() gate — every entry
// without one is either genuinely open to everyone (Employee Portal) or was
// an oversight before this list was audited. An EMPLOYEE calling any of the
// underlying list endpoints for Employees/Payroll/Analytics/Compliance/Leave
// Management gets a 403 today, so showing the link at all was misleading.
const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: [Role.ADMIN, Role.HR],
  },
  {
    name: 'Employees',
    href: '/employees',
    icon: Users,
    roles: [Role.ADMIN, Role.HR],
  },
  {
    name: 'Payroll',
    href: '/payroll',
    icon: Calculator,
    roles: [Role.ADMIN, Role.HR],
  },
  {
    name: 'Leave Management',
    href: '/leave',
    icon: Calendar,
    roles: [Role.ADMIN, Role.HR],
  },
  {
    name: 'Loans & Advances',
    href: '/loans',
    icon: Wallet,
    roles: [Role.ADMIN, Role.HR],
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    roles: [Role.ADMIN, Role.HR],
  },
  { name: 'Employee Portal', href: '/employee-portal', icon: UserCircle },
  {
    name: 'Compliance',
    href: '/compliance',
    icon: FileCheck,
    roles: [Role.ADMIN, Role.HR],
  },
  // Billing, Audit Log, and Settings are ADMIN-only server- and UI-gated;
  // hide the links themselves too so non-admins don't see a
  // permission-denied page.
  { name: 'Audit Log', href: '/audit-log', icon: History, roles: [Role.ADMIN] },
  { name: 'Blog', href: '/blog-admin', icon: Newspaper, roles: [Role.ADMIN] },
  { name: 'Billing', href: '/billing', icon: CreditCard, roles: [Role.ADMIN] },
  { name: 'Settings', href: '/settings', icon: Settings, roles: [Role.ADMIN] },
];

function SidebarBrand() {
  const branding = useBranding();
  return (
    <div className="flex items-center gap-2">
      {branding.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={branding.logoUrl}
          alt={branding.appName}
          className="h-8 w-8 object-contain"
        />
      ) : (
        <Logo className="h-8 w-8" color={branding.primaryColor ?? undefined} />
      )}
      <span className="text-xl font-extrabold text-sidebar-foreground">
        {branding.appName}
      </span>
    </div>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const visibleNavigation = navigation.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  );

  return (
    <nav className="flex-1 px-4 py-6 space-y-2">
      {visibleNavigation.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.name}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 px-3 py-2 text-sm font-bold rounded-lg border-2 transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground border-border shadow-brutal-sm'
                : 'border-transparent text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
}

export default function Sidebar() {
  const { open, setOpen } = useMobileSidebar();

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex h-full w-64 flex-col fixed inset-y-0 z-40 bg-sidebar border-r-2 border-sidebar-border">
        <div className="flex items-center h-16 px-6 border-b-2 border-sidebar-border">
          <SidebarBrand />
        </div>
        <SidebarNav />
      </div>

      {/* Mobile sidebar drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="bg-sidebar text-sidebar-foreground w-72 p-0 [&>button]:hidden"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>App navigation menu</SheetDescription>
          </SheetHeader>
          <div className="flex items-center h-16 px-6 border-b-2 border-sidebar-border">
            <SidebarBrand />
          </div>
          <SidebarNav onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
