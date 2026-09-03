'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
import { Role } from "@/shared-types"

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