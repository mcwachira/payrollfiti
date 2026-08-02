import { useMemo, useState } from 'react';

export type SortDirection = 'asc' | 'desc';

/**
 * Generic client-side table sort: pass the already-fetched rows plus a map
 * of column key -> value-getter, get back sorted rows and a toggler to wire
 * up to a clickable header. Sorting happens over what's already on the
 * page (React Query's cached list), not a new server request — every
 * table this applies to today is small enough (one company's employees,
 * one payroll run's entries) that a server-side sort would be pure
 * overhead.
 */
export function useSort<T, K extends string>(
  rows: T[],
  getters: Record<K, (row: T) => string | number>,
  initialKey?: K,
  initialDirection: SortDirection = 'asc',
) {
  const [sortKey, setSortKey] = useState<K | undefined>(initialKey);
  const [direction, setDirection] = useState<SortDirection>(initialDirection);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const getValue = getters[sortKey];
    const withIndex = rows.map((row, index) => ({ row, index }));
    withIndex.sort((a, b) => {
      const av = getValue(a.row);
      const bv = getValue(b.row);
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv));
      // Stable: ties fall back to original order rather than Array.sort's
      // engine-dependent behavior for equal keys.
      return (direction === 'asc' ? cmp : -cmp) || a.index - b.index;
    });
    return withIndex.map((w) => w.row);
  }, [rows, sortKey, direction, getters]);

  function toggle(key: K) {
    if (key !== sortKey) {
      setSortKey(key);
      setDirection('asc');
    } else {
      setDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    }
  }

  return { sorted, sortKey, direction, toggle };
}
