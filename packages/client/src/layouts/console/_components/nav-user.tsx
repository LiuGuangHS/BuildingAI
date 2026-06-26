import { useAuthStore } from "@buildingai/stores";
import { Avatar, AvatarFallback, AvatarImage } from "@buildingai/ui/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@buildingai/ui/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@buildingai/ui/components/ui/dropdown-menu";
import { NotificationCenter } from "@buildingai/ui/components/notification-center";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@buildingai/ui/components/ui/sidebar";
import { useAlertDialog } from "@buildingai/ui/hooks/use-alert-dialog";
import { isEnabled } from "@buildingai/utils/is";
import { ChevronsUpDown, LogOut, Settings, User } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useSettingsDialog } from "@/components/settings-dialog";

export function NavUser() {
  const { isMobile } = useSidebar();
  const { userInfo } = useAuthStore((state) => state.auth);
  const { logout, isLogin } = useAuthStore((state) => state.authActions);

  const settingsDialog = useSettingsDialog();
  const location = useLocation();
  const navigate = useNavigate();
  const { confirm } = useAlertDialog();

  const [versionInfoOpen, setVersionInfoOpen] = useState(false);

  return (
    <SidebarMenu>
      <SidebarMenuItem className="relative">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground overflow-visible pr-20"
            >
              <Avatar className="h-8 w-8 rounded-lg after:rounded-lg">
                {isLogin() && (
                  <AvatarImage
                    className="rounded-lg"
                    src={userInfo?.avatar}
                    alt={userInfo?.nickname}
                  />
                )}
                <AvatarFallback className="rounded-lg">
                  {isLogin() ? userInfo?.nickname?.slice(0, 1) : <User />}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{userInfo?.nickname || "未登录"}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {isLogin()
                    ? isEnabled(userInfo?.isRoot)
                      ? "超级管理员"
                      : userInfo?.role?.name || "未设置角色"
                    : "请先登录后使用"}
                </span>
              </div>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <div className="absolute top-1/2 right-9 z-10 -translate-y-1/2 group-data-[collapsible=icon]/sidebar-wrapper:hidden">
            <NotificationCenter placement="sidebar" />
          </div>
          <ChevronsUpDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 group-data-[collapsible=icon]/sidebar-wrapper:hidden" />
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuItem onClick={() => settingsDialog.open("general")}>
              <Settings />
              设置
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={async () => {
                await confirm({
                  title: "退出确认",
                  description: "确定要退出登录吗？",
                });
                await logout();
                const redirect = encodeURIComponent(location.pathname + location.search);
                navigate(`/login?redirect=${redirect}`, {
                  replace: true,
                  state: { redirect: location.pathname },
                });
              }}
            >
              <LogOut />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
      <Dialog open={versionInfoOpen} onOpenChange={setVersionInfoOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>关于清云AI</DialogTitle>
            <div className="mt-4 flex items-center gap-1">
              <span className="text-muted-foreground">版本：</span>
              <span>1.0.0</span>
            </div>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </SidebarMenu>
  );
}
