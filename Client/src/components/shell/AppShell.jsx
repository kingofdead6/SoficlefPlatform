import { Outlet } from 'react-router-dom';

import { SidebarNav } from './SidebarNav.jsx';
import { TopBar } from './TopBar.jsx';
import { SidebarProvider } from './SidebarContext.jsx';

export function AppShell() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen items-start bg-bg">
        <SidebarNav />
        {/*
          min-w-0 is load-bearing: without it a wide child (a data table, the org chart)
          can grow this flex column past the viewport and shove the layout sideways.
        */}
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
            <div className="flex flex-1 flex-col">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
