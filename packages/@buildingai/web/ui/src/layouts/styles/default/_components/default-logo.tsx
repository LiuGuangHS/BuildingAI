import { useConfigStore } from "@buildingai/stores";
import { Avatar, AvatarFallback, AvatarImage } from "@buildingai/ui/components/ui/avatar";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@buildingai/ui/components/ui/sidebar";
import { cn } from "@buildingai/ui/lib/utils";
import { Link } from "react-router-dom";

export function DefaultLogo() {
  const { websiteConfig } = useConfigStore((state) => state.config);
  const { state } = useSidebar();
  const siteName = websiteConfig?.webinfo.name || "EchoFlowAI";

  return (
    <SidebarMenu>
      <SidebarMenuItem className="flex justify-center">
        <SidebarMenuButton size="lg" className="justify-center" asChild>
          <div className="group/default-logo-button relative flex items-center justify-center">
            <div className="relative flex size-8 items-center justify-center">
              <SidebarTrigger
                className={cn("absolute inset-0 z-2 hidden opacity-0 transition-opacity md:flex", {
                  "flex md:group-hover/default-logo-button:opacity-100": state === "collapsed",
                  "pointer-events-none hidden": state === "expanded",
                })}
              />
              <Link
                to="/"
                className={cn("transition-opacity duration-200", {
                  "relative z-1 md:group-hover/default-logo-button:opacity-0":
                    state === "collapsed",
                })}
              >
                <>
                  {websiteConfig?.webinfo.logo ? (
                    <Avatar className="size-8 shrink-0 rounded-md after:hidden">
                      <AvatarImage
                        className="rounded-md"
                        src={websiteConfig?.webinfo.logo}
                        alt={siteName}
                      />
                      <AvatarFallback className="rounded-md">
                        {siteName.slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <img className="size-8 rounded-md object-contain" src="/logo.png" alt={siteName} />
                  )}
                </>
              </Link>
            </div>
            {state === "expanded" && (
              <SidebarTrigger className="hover:bg-accent-foreground/5 absolute top-1/2 right-2 -translate-y-1/2" />
            )}
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
