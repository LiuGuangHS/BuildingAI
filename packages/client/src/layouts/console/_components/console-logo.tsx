import { useConfigStore } from "@buildingai/stores";
import { Avatar, AvatarFallback, AvatarImage } from "@buildingai/ui/components/ui/avatar";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@buildingai/ui/components/ui/sidebar";
import { cn } from "@buildingai/ui/lib/utils";
import { Link } from "react-router-dom";

function formatBrandVersion(version?: string) {
  if (!version) return "26.0.0";
  return version.split("+")[0] || version;
}

export function ConsoleLogo() {
  const { websiteConfig } = useConfigStore((state) => state.config);
  const { state } = useSidebar();
  const siteName = websiteConfig?.webinfo.name || "清云AI";
  const siteVersion = formatBrandVersion(websiteConfig?.webinfo.version);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          className={cn("justify-start", state === "collapsed" && "justify-center")}
          asChild
        >
          <Link to="/" aria-label={siteName}>
            {websiteConfig?.webinfo.logo ? (
              <Avatar className="size-8 shrink-0 rounded-md after:hidden">
                <AvatarImage className="rounded-md" src={websiteConfig.webinfo.logo} alt={siteName} />
                <AvatarFallback className="rounded-md">
                  {siteName.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ) : (
              <img className="size-8 shrink-0 rounded-md object-contain" src="/logo.png" alt={siteName} />
            )}
            <div className="flex min-w-0 flex-1 flex-col justify-center text-left text-sm group-data-[collapsible=icon]:hidden">
              <span className="truncate font-medium">{siteName}</span>
              <span className="text-muted-foreground truncate text-xs">工作台 · v{siteVersion}</span>
            </div>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
