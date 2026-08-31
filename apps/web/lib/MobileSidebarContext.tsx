'use client';

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

interface MobileSidebarContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

const MobileSidebarContext = createContext<MobileSidebarContextValue | null>(
  null,
);

export function MobileSidebarProvider({ children }: PropsWithChildren) {
  const [open, setOpen] = useState(false);

  const value = useMemo<MobileSidebarContextValue>(
    () => ({ open, setOpen, toggle: () => setOpen((prev) => !prev) }),
    [open],
  );

  return (
    <MobileSidebarContext.Provider value={value}>
      {children}
    </MobileSidebarContext.Provider>
  );
}

export function useMobileSidebar() {
  const context = useContext(MobileSidebarContext);
  if (!context) {
    throw new Error(
      'useMobileSidebar must be used within a MobileSidebarProvider',
    );
  }
  return context;
}
