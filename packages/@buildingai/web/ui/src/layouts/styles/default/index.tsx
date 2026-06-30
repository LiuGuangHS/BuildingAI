import { SidebarInset, SidebarProvider, useSidebar } from "@buildingai/ui/components/ui/sidebar";
import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { DefaultAppSidebar } from "./_components/default-sidebar";

function AutoCollapseForPluginApps() {
  const { pathname } = useLocation();
  const { setOpen } = useSidebar();
  const wasPluginPath = useRef(false);
  const isPluginPath = pathname.startsWith("/apps/");

  useEffect(() => {
    if (isPluginPath && !wasPluginPath.current) {
      setOpen(false);
    }

    wasPluginPath.current = isPluginPath;
  }, [isPluginPath, setOpen]);

  return null;
}

export default function DefaultLayout({ children }: { children?: React.ReactNode }) {
  return (
    <SidebarProvider storageKey="layout-style-default-sidebar">
      <AutoCollapseForPluginApps />
      <DefaultAppSidebar />
      <SidebarInset className="h-dvh overflow-x-hidden">{children || <Outlet />}</SidebarInset>
    </SidebarProvider>
  );
}
