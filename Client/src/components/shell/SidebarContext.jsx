import { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Open/closed state for the mobile sidebar drawer, shared between TopBar (which renders the
 * toggle button) and SidebarNav (which renders the drawer itself) without prop-drilling
 * through AppShell. Above the `lg` breakpoint the sidebar is always visible and this state
 * is simply unused.
 */
const SidebarContext = createContext(null);

export function SidebarProvider({ children }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Close on navigation — the drawer is a means to get to a page, not a panel to leave open.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return <SidebarContext.Provider value={{ open, setOpen }}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) throw new Error('useSidebar must be used within a SidebarProvider');
  return context;
}
