import { SidebarInset, SidebarProvider, useSidebar } from "@buildingai/ui/components/ui/sidebar";
import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { DefaultAppSidebar } from "./_components/default-sidebar";

function AutoCollapseForApps() {
  const { pathname } = useLocation();
  const { open, setOpen } = useSidebar();

  useEffect(() => {
    if (pathname.startsWith("/apps") && open) {
      setOpen(false);
    }
  }, [open, pathname, setOpen]);

  return null;
}

export default function DefaultLayout({ children }: { children?: React.ReactNode }) {
  return (
    <SidebarProvider storageKey="layout-style-default-sidebar">
      <AutoCollapseForApps />
      <DefaultAppSidebar />
      <SidebarInset className="h-dvh overflow-x-hidden">{children || <Outlet />}</SidebarInset>
    </SidebarProvider>
  );
}
