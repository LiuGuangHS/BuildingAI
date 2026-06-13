import {
  useCreateTestNotificationMutation,
  useNotificationPushPublicKeyQuery,
  useNotificationPushStatusQuery,
  useNotificationsQuery,
  useSubscribeNotificationPushMutation,
  useUnsubscribeNotificationPushMutation,
} from "@buildingai/services";
import { useAuthStore } from "@buildingai/stores";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Skeleton } from "@buildingai/ui/components/ui/skeleton";
import { Switch } from "@buildingai/ui/components/ui/switch";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { BellRing, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { SettingItem, SettingItemGroup } from "../setting-item";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function serializeSubscription(subscription: PushSubscription) {
  const raw = subscription.toJSON();
  if (!raw.endpoint || !raw.keys?.p256dh || !raw.keys?.auth) {
    throw new Error("浏览器通知订阅信息不完整");
  }

  return {
    endpoint: raw.endpoint,
    expirationTime: raw.expirationTime ?? null,
    keys: {
      p256dh: raw.keys.p256dh,
      auth: raw.keys.auth,
    },
  };
}

const NoticeSetting = () => {
  const { isLogin } = useAuthStore((state) => state.authActions);
  const pushSupported = useMemo(
    () =>
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      (window.isSecureContext || window.location.hostname === "localhost"),
    [],
  );
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default",
  );

  const pushStatusQuery = useNotificationPushStatusQuery({ enabled: pushSupported });
  const pushPublicKeyQuery = useNotificationPushPublicKeyQuery({ enabled: pushSupported });
  const notificationsQuery = useNotificationsQuery({ page: 1, pageSize: 5 }, { enabled: isLogin() });
  const subscribeMutation = useSubscribeNotificationPushMutation({
    onSuccess: () => toast.success("应用通知已开启"),
  });
  const unsubscribeMutation = useUnsubscribeNotificationPushMutation({
    onSuccess: () => toast.success("应用通知已关闭"),
  });
  const testMutation = useCreateTestNotificationMutation({
    onSuccess: () => toast.success("测试通知已发送"),
  });

  const enablePush = async () => {
    if (!pushSupported) {
      toast.error("当前浏览器不支持应用通知");
      return;
    }

    const publicKey = pushPublicKeyQuery.data?.publicKey;
    if (!publicKey) {
      toast.error("通知公钥还未准备好，请稍后重试");
      return;
    }

    const nextPermission =
      Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
    setPermission(nextPermission);

    if (nextPermission !== "granted") {
      toast.error("浏览器未授予通知权限");
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }));

    await subscribeMutation.mutateAsync(serializeSubscription(subscription));
  };

  const disablePush = async () => {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    await unsubscribeMutation.mutateAsync({ endpoint: subscription?.endpoint });
    await subscription?.unsubscribe();
  };

  const handlePushChange = (checked: boolean) => {
    if (checked) {
      void enablePush();
    } else {
      void disablePush();
    }
  };

  const enabled = Boolean(pushStatusQuery.data?.enabled);
  const busy =
    pushStatusQuery.isLoading ||
    pushPublicKeyQuery.isLoading ||
    subscribeMutation.isPending ||
    unsubscribeMutation.isPending;

  return (
    <div className="flex flex-col gap-4">
      <SettingItemGroup label="应用通知">
        <SettingItem
          title="浏览器通知"
          description={
            pushSupported
              ? "长任务完成、失败或状态更新时，可通过系统通知提醒你。"
              : "当前环境不支持浏览器通知，需要 HTTPS 或 localhost。"
          }
        >
          <Switch checked={enabled} disabled={!pushSupported || busy} onCheckedChange={handlePushChange} />
        </SettingItem>
        <SettingItem
          title="通知权限"
          description={
            permission === "granted"
              ? "浏览器已允许 EchoFlowAI 发送通知。"
              : permission === "denied"
                ? "浏览器已阻止通知，需要在浏览器站点设置中手动允许。"
                : "首次开启时浏览器会请求通知权限。"
          }
        >
          <Badge variant={permission === "granted" ? "secondary" : "outline"}>
            {permission === "granted" ? "已允许" : permission === "denied" ? "已阻止" : "未设置"}
          </Badge>
        </SettingItem>
        <SettingItem title="测试通知" description="创建一条站内通知，并尝试通过 PWA 推送提醒。">
          <Button
            variant="ghost"
            size="sm"
            disabled={!isLogin()}
            loading={testMutation.isPending}
            onClick={() => testMutation.mutate()}
          >
            <Send className="size-4" />
            发送测试
          </Button>
        </SettingItem>
      </SettingItemGroup>

      <SettingItemGroup label="最近通知">
        {notificationsQuery.isLoading ? (
          <>
            <SettingItem title={<Skeleton className="h-4 w-32" />} description={<Skeleton className="h-3 w-48" />} />
            <SettingItem title={<Skeleton className="h-4 w-28" />} description={<Skeleton className="h-3 w-40" />} />
          </>
        ) : notificationsQuery.data?.items.length ? (
          notificationsQuery.data.items.map((item) => (
            <SettingItem
              key={item.id}
              icon={<BellRing className="text-muted-foreground size-4" />}
              title={
                <span className={item.readAt ? "text-muted-foreground" : "font-medium"}>
                  {item.title}
                </span>
              }
              description={item.content || "暂无详细内容"}
              extra={formatDistanceToNow(new Date(item.createdAt), {
                addSuffix: true,
                locale: zhCN,
              })}
            >
              {!item.readAt && <div className="bg-primary size-2 rounded-full" />}
            </SettingItem>
          ))
        ) : (
          <SettingItem title="暂无通知" description="任务状态更新后会在这里显示。" />
        )}
      </SettingItemGroup>
    </div>
  );
};

export { NoticeSetting };
