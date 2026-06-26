import {
  type NotificationItem,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useNotificationsQuery,
  useNotificationUnreadCountQuery,
} from "@buildingai/services";
import { useSettingsDialog } from "@buildingai/hooks";
import { useAuthStore, useConfigStore } from "@buildingai/stores";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@buildingai/ui/components/ui/popover";
import { ScrollArea } from "@buildingai/ui/components/ui/scroll-area";
import { Skeleton } from "@buildingai/ui/components/ui/skeleton";
import { cn } from "@buildingai/ui/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Bell, CheckCheck, ExternalLink, Inbox } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const NOTIFICATION_PUSH_MESSAGE = "buildingai:notification-push";

function NotificationTime({ value }: { value: string }) {
  return (
    <span className="text-muted-foreground text-[11px]">
      {formatDistanceToNow(new Date(value), {
        addSuffix: true,
        locale: zhCN,
      })}
    </span>
  );
}

function getTargetUrl(linkUrl?: string | null) {
  if (!linkUrl) return null;

  try {
    const targetUrl = new URL(linkUrl, window.location.origin);
    if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") return null;
    if (targetUrl.username || targetUrl.password) return null;
    if (linkUrl.trim().startsWith("//")) return null;
    return targetUrl;
  } catch {
    return null;
  }
}

function NotificationRow({
  item,
  onOpen,
  disabled,
}: {
  item: NotificationItem;
  onOpen: (item: NotificationItem) => void;
  disabled?: boolean;
}) {
  const targetUrl = getTargetUrl(item.linkUrl);
  const unread = !item.readAt;

  return (
    <Button
      type="button"
      variant="ghost"
      disabled={disabled}
      onClick={() => onOpen(item)}
      className={cn(
        "h-auto w-full justify-start gap-3 rounded-md p-3 text-left whitespace-normal",
        "hover:bg-muted/70 focus-visible:ring-ring/50 focus-visible:ring-[3px]",
      )}
    >
      <span className={cn("mt-1 size-2 rounded-full bg-transparent", unread && "bg-primary")} />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "flex min-w-0 items-start justify-between gap-3 text-sm",
            unread ? "font-medium" : "text-muted-foreground",
          )}
        >
          <span className="line-clamp-1">{item.title}</span>
          {targetUrl && <ExternalLink className="text-muted-foreground mt-0.5 size-3 shrink-0" />}
        </span>
        <span className="text-muted-foreground mt-1 line-clamp-2 text-xs">
          {item.content || "暂无详细内容"}
        </span>
        <span className="mt-2 block">
          <NotificationTime value={item.createdAt} />
        </span>
      </span>
    </Button>
  );
}

export function NotificationCenter({
  placement = "floating",
}: {
  placement?: "floating" | "inline" | "sidebar";
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const settingsDialog = useSettingsDialog();
  const { isLogin } = useAuthStore((state) => state.authActions);
  const { websiteConfig } = useConfigStore((state) => state.config);
  const [open, setOpen] = useState(false);
  const siteName = websiteConfig?.webinfo?.name || "清云AI";
  const isLoggedIn = isLogin();

  const unreadCountQuery = useNotificationUnreadCountQuery({
    enabled: isLoggedIn,
    refetchInterval: 15_000,
  });
  const notificationsQuery = useNotificationsQuery(
    { page: 1, pageSize: 8, readStatus: "all" },
    { enabled: isLoggedIn && open },
  );
  const markReadMutation = useMarkNotificationReadMutation();
  const markAllReadMutation = useMarkAllNotificationsReadMutation({
    onSuccess: () => toast.success("通知已全部标记为已读"),
  });

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== NOTIFICATION_PUSH_MESSAGE) return;

      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, [queryClient]);

  useEffect(() => {
    if (!open) return;

    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }, [open, queryClient]);

  useEffect(() => {
    const handleFocus = () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [queryClient]);

  if (!isLoggedIn) return null;

  const unreadCount = unreadCountQuery.data?.count ?? 0;
  const notifications = notificationsQuery.data?.items ?? [];
  const sidebar = placement === "sidebar";

  const handleOpenNotification = async (item: NotificationItem) => {
    try {
      if (!item.readAt) {
        await markReadMutation.mutateAsync(item.id);
      }

      const targetUrl = getTargetUrl(item.linkUrl);
      if (targetUrl) {
        if (targetUrl.origin === window.location.origin) {
          navigate(`${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`);
        } else {
          window.open(targetUrl.href, "_blank", "noopener,noreferrer");
        }
        setOpen(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "通知状态更新失败");
    }
  };

  const content = (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant={sidebar ? "ghost" : "outline"}
          className={cn(
            "pointer-events-auto relative",
            sidebar
              ? "size-7 rounded-full bg-transparent shadow-none hover:bg-sidebar-accent-foreground/10"
              : "bg-background/90 shadow-sm backdrop-blur",
          )}
          aria-label="通知中心"
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <Badge
              className={cn(
                "absolute h-4 min-w-4 px-1 text-[10px]",
                sidebar ? "-top-1 -right-1" : "-top-1.5 -right-1.5",
              )}
              variant="default"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side={sidebar ? "right" : "bottom"}
        sideOffset={sidebar ? 12 : placement === "inline" ? 10 : 6}
        className="pointer-events-auto flex max-h-[calc(100vh-6rem)] w-[calc(100vw-24px)] max-w-[380px] flex-col gap-0 overflow-hidden p-0 md:max-h-[40rem]"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <div className="text-sm font-medium">通知中心</div>
            <div className="text-muted-foreground text-xs">
              {unreadCount > 0 ? `${unreadCount} 条未读通知` : "暂无未读通知"}
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={unreadCount === 0}
            loading={markAllReadMutation.isPending}
            onClick={() => markAllReadMutation.mutate()}
          >
            <CheckCheck className="size-4" />
            全部已读
          </Button>
        </div>
        <ScrollArea className="h-[min(28rem,calc(100vh-12rem))]">
          <div className="p-2">
            {notificationsQuery.isLoading ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="space-y-2 rounded-md p-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-64" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                ))}
              </div>
            ) : notifications.length ? (
              notifications.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  disabled={markReadMutation.isPending}
                  onOpen={handleOpenNotification}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center px-8 py-12 text-center">
                <Inbox className="text-muted-foreground mb-3 size-8" />
                <div className="text-sm font-medium">暂无通知</div>
                <div className="text-muted-foreground mt-1 text-xs">
                  {siteName} 的任务状态、系统消息会在这里显示。
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="bg-background border-t p-2">
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              setOpen(false);
              settingsDialog.open("notice");
            }}
          >
            通知设置
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );

  if (placement === "inline" || placement === "sidebar") {
    return <div className="pointer-events-auto">{content}</div>;
  }

  return <div className="pointer-events-none fixed right-4 bottom-4 z-40">{content}</div>;
}
