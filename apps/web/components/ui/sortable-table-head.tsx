'use client';

import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { SortDirection } from '@/hooks/use-sort';

interface SortableTableHeadProps {
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}

/** A <TableHead> that's also a sort toggle — click cycles asc/desc, an icon shows current state. */
export function SortableTableHead({
  active,
  direction,
  onClick,
  className,
  children,
}: SortableTableHeadProps) {
  const Icon = active
    ? direction === 'asc'
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex items-center gap-1 font-bold hover:text-primary transition-colors',
          active && 'text-primary',
        )}
      >
        {children}
        <Icon className="h-3.5 w-3.5" />
      </button>
    </TableHead>
  );
}
