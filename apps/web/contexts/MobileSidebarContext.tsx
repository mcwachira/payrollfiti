"use client"
import {createContext, useContext, useEffect, useState, type PropsWithChildren, useMemo } from "react";
interface MobileSidebarContextProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

const MobileSidebarContext = createContext<MobileSidebarContextProps | null>(null);

export function MobileSidebarProvider({ children }: PropsWithChildren) {

  const [open, setOpen] = useState<boolean>(false);

  const value = useMemo<MobileSidebarContextProps>(() => ({open, setOpen, toggle:() => setOpen((prev) => !prev)}), [open],
  );

  return (
    <MobileSidebarContext.Provider value={value}>{children}</MobileSidebarContext.Provider>
  )
}

export function useMobileSidebar(){
  const context = useContext(MobileSidebarContext);
  if(!context){
    throw new Error(
      'useMobileSidebar must be used within a MobileSidebarProvider',
    );
  }
  return context;
}