import {
  type NotificationChannelStatus,
  type NotificationDelivery,
  type NotificationScene,
  useNotificationChannelsQuery,
  useNotificationDeliveriesQuery,
  useNotificationScenesQuery,
  useTestNotificationSceneMutation,
  useUpdateNotificationSceneMutation,
} from "@buildingai/services/console";
import { PermissionGuard } from "@buildingai/ui/components/auth/permission-guard";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Checkbox } from "@buildingai/ui/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@buildingai/ui/components/ui/dialog";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { ScrollArea } from "@buildingai/ui/components/ui/scroll-area";
import { Skeleton } from "@buildingai/ui/components/ui/skeleton";
import { Switch } from "@buildingai/ui/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@buildingai/ui/components/ui/table";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCircle2, ClipboardList, MessageSquareText, Send, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@buildingai/ui/lib/utils";

import { PageContainer } from "@/layouts/console/_components/page-container";

const CHANNEL_OPTIONS = [
  { value: "in_app", label: "站内" },
  { value: "web_push", label: "浏览器" },
  { value: "wechat_oa_template", label: "公众号" },
  { value: "sms", label: "短信", disabled: true, description: "预留渠道，当前不可用于业务通知" },
];

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  sent: "secondary",
  pending: "outline",
  failed: "destructive",
  skipped: "outline",
};

function channelLabel(channel: string) {
  return CHANNEL_OPTIONS.find((item) => item.value === channel)?.label || channel;
}

function sourceLabel(item: NotificationDelivery) {
  if (item.sourceType && item.sourceId) return `${item.sourceType} / ${item.sourceId}`;
  if (item.sourceType) return item.sourceType;
  if (item.sourceId) return item.sourceId;
  return "-";
}

function InlineState({
  title,
  description,
  rows = 3,
}: {
  title?: string;
  description?: string;
  rows?: number;
}) {
  if (!title && !description) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="text-muted-foreground flex min-h-28 flex-col items-center justify-center gap-1 px-4 text-center text-sm">
      {title && <div className="text-foreground font-medium">{title}</div>}
      {description && <div className="text-xs">{description}</div>}
    </div>
  );
}

function SceneEditor({
  scene,
  open,
  onOpenChange,
}: {
  scene: NotificationScene | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    isEnabled: true,
    channels: [] as string[],
    titleTemplate: "",
    contentTemplate: "",
    linkUrlTemplate: "",
    wechatTemplateId: "",
    wechatUrl: "",
    wechatFields: "",
  });

  useEffect(() => {
    if (!scene) return;
    const template = scene.wechatTemplate || {};
    setForm({
      isEnabled: scene.isEnabled,
      channels: scene.channels || [],
      titleTemplate: scene.titleTemplate || "",
      contentTemplate: scene.contentTemplate || "",
      linkUrlTemplate: scene.linkUrlTemplate || "",
      wechatTemplateId: typeof template.templateId === "string" ? template.templateId : "",
      wechatUrl: typeof template.url === "string" ? template.url : "",
      wechatFields: template.fields ? JSON.stringify(template.fields, null, 2) : "",
    });
  }, [scene]);

  const updateMutation = useUpdateNotificationSceneMutation(scene?.sceneCode || "", {
    onSuccess: () => {
      toast.success("通知场景已保存");
      void queryClient.invalidateQueries({ queryKey: ["notification", "scenes"] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message || "保存通知场景失败"),
  });

  const handleSubmit = () => {
    if (!scene) return;
    let fields: Record<string, unknown> = {};
    if (form.wechatFields.trim()) {
      try {
        fields = JSON.parse(form.wechatFields);
      } catch {
        toast.error("公众号字段映射不是有效 JSON");
        return;
      }
    }
    const channels = form.channels.filter((channel) => channel !== "sms");
    if (!channels.length) {
      toast.error("至少需要启用一个通知渠道");
      return;
    }

    updateMutation.mutate({
      isEnabled: form.isEnabled,
      channels,
      titleTemplate: form.titleTemplate,
      contentTemplate: form.contentTemplate,
      linkUrlTemplate: form.linkUrlTemplate,
      wechatTemplate: {
        templateId: form.wechatTemplateId,
        url: form.wechatUrl,
        fields,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{scene?.name || "通知场景"}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[68vh] pr-3">
          <div className="grid gap-5 py-1">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">启用场景</div>
                <div className="text-muted-foreground text-xs">
                  关闭后不会自动向该场景创建业务通知。
                </div>
              </div>
              <Switch
                checked={form.isEnabled}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isEnabled: checked }))}
              />
            </div>

            <div className="space-y-2">
              <Label>默认渠道</Label>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {CHANNEL_OPTIONS.map((channel) => (
                  <label
                    key={channel.value}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                      channel.disabled && "text-muted-foreground opacity-70",
                    )}
                    title={channel.description}
                  >
                    <Checkbox
                      checked={form.channels.includes(channel.value)}
                      disabled={channel.disabled}
                      onCheckedChange={(checked) =>
                        setForm((prev) => ({
                          ...prev,
                          channels: checked
                            ? [...new Set([...prev.channels, channel.value])]
                            : prev.channels.filter((item) => item !== channel.value),
                        }))
                      }
                    />
                    {channel.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>站内标题模板</Label>
                <Input
                  value={form.titleTemplate}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, titleTemplate: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>跳转链接模板</Label>
                <Input
                  value={form.linkUrlTemplate}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, linkUrlTemplate: event.target.value }))
                  }
                  placeholder="/extension/..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>站内内容模板</Label>
              <Textarea
                value={form.contentTemplate}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, contentTemplate: event.target.value }))
                }
                rows={3}
              />
            </div>

            <div className="rounded-md border p-4">
              <div className="mb-3 flex items-center gap-2">
                <MessageSquareText className="size-4" />
                <div className="text-sm font-medium">微信公众号模板消息</div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>模板 ID</Label>
                  <Input
                    value={form.wechatTemplateId}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, wechatTemplateId: event.target.value }))
                    }
                    placeholder="公众号后台模板 ID"
                  />
                </div>
                <div className="space-y-2">
                  <Label>跳转 URL</Label>
                  <Input
                    value={form.wechatUrl}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, wechatUrl: event.target.value }))
                    }
                    placeholder="https://... 或站内路径"
                  />
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <Label>字段映射 JSON</Label>
                <Textarea
                  value={form.wechatFields}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, wechatFields: event.target.value }))
                  }
                  rows={7}
                  placeholder={
                    '{\n  "thing1": "{{taskName}}",\n  "phrase2": "已完成",\n  "time3": "{{completedAt}}"\n}'
                  }
                />
              </div>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <PermissionGuard permissions="notification:notification-scenes-update">
            <Button loading={updateMutation.isPending} onClick={handleSubmit}>
              保存
            </Button>
          </PermissionGuard>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChannelCard({ channel }: { channel: NotificationChannelStatus }) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {channel.ready ? (
            <CheckCircle2 className="size-4 text-emerald-600" />
          ) : (
            <XCircle className="text-muted-foreground size-4" />
          )}
          <span className="text-sm font-medium">{channel.name}</span>
        </div>
        <Badge variant={channel.ready ? "secondary" : "outline"}>
          {channel.ready ? "就绪" : "待配置"}
        </Badge>
      </div>
      <div className="text-muted-foreground mt-2 text-xs leading-5">{channel.description}</div>
    </div>
  );
}

function DeliveryRow({ item }: { item: NotificationDelivery }) {
  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{item.sceneCode}</div>
        <div className="text-muted-foreground text-xs">
          {item.extensionId || "main"} · {item.userId}
        </div>
      </TableCell>
      <TableCell className="max-w-[220px]">
        <div className="truncate text-xs">{sourceLabel(item)}</div>
      </TableCell>
      <TableCell>{channelLabel(item.channel)}</TableCell>
      <TableCell>
        <Badge variant={statusVariant[item.status] || "outline"}>{item.status}</Badge>
      </TableCell>
      <TableCell>{item.attempts}</TableCell>
      <TableCell className="max-w-[260px]">
        <div className="truncate text-xs">{item.errorMessage || item.providerMessageId || "-"}</div>
      </TableCell>
      <TableCell className="text-muted-foreground text-xs">
        {new Date(item.createdAt).toLocaleString("zh-CN")}
      </TableCell>
    </TableRow>
  );
}

function SceneTestButton({ scene }: { scene: NotificationScene }) {
  const queryClient = useQueryClient();
  const testMutation = useTestNotificationSceneMutation(scene.sceneCode, {
    onSuccess: () => {
      toast.success("测试通知已发送");
      void queryClient.invalidateQueries({ queryKey: ["notification", "deliveries"] });
    },
    onError: (error: Error) => toast.error(error.message || "测试通知发送失败"),
  });

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={!scene.isEnabled}
      loading={testMutation.isPending}
      title="发送测试通知"
      aria-label={`发送 ${scene.name} 测试通知`}
      onClick={() => testMutation.mutate({ channels: scene.channels })}
    >
      <Send className="size-4" />
    </Button>
  );
}

export default function NotificationManagementPage() {
  const [editingScene, setEditingScene] = useState<NotificationScene | null>(null);
  const scenesQuery = useNotificationScenesQuery();
  const channelsQuery = useNotificationChannelsQuery();
  const deliveriesQuery = useNotificationDeliveriesQuery({ page: 1, pageSize: 10 });
  const scenes = scenesQuery.data || [];
  const enabledCount = useMemo(() => scenes.filter((scene) => scene.isEnabled).length, [scenes]);

  return (
    <PageContainer>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">通知管理</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              管理站内、浏览器和微信公众号模板消息的场景配置与投递结果。
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 md:w-[360px]">
            <div className="rounded-md border px-3 py-2">
              <div className="text-muted-foreground text-xs">场景</div>
              <div className="text-lg font-semibold">{scenes.length}</div>
            </div>
            <div className="rounded-md border px-3 py-2">
              <div className="text-muted-foreground text-xs">启用</div>
              <div className="text-lg font-semibold">{enabledCount}</div>
            </div>
            <div className="rounded-md border px-3 py-2">
              <div className="text-muted-foreground text-xs">投递</div>
              <div className="text-lg font-semibold">{deliveriesQuery.data?.total ?? 0}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="size-4" />
                通知场景
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>场景</TableHead>
                      <TableHead>渠道</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="w-[180px]">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scenesQuery.isLoading &&
                      Array.from({ length: 4 }).map((_, index) => (
                        <TableRow key={`scene-loading-${index}`}>
                          <TableCell colSpan={4}>
                            <InlineState rows={1} />
                          </TableCell>
                        </TableRow>
                      ))}
                    {scenesQuery.isError && (
                      <TableRow>
                        <TableCell colSpan={4}>
                          <InlineState
                            title="场景加载失败"
                            description="请稍后刷新，或检查通知服务状态。"
                          />
                        </TableCell>
                      </TableRow>
                    )}
                    {!scenesQuery.isLoading &&
                      !scenesQuery.isError &&
                      scenes.map((scene) => (
                        <TableRow key={scene.id}>
                          <TableCell>
                            <div className="font-medium">{scene.name}</div>
                            <div className="text-muted-foreground text-xs">{scene.sceneCode}</div>
                            <div className="text-muted-foreground mt-1 line-clamp-1 text-xs">
                              {scene.description}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {scene.channels.map((channel) => (
                                <Badge key={channel} variant="outline">
                                  {channelLabel(channel)}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={scene.isEnabled ? "secondary" : "outline"}>
                              {scene.isEnabled ? "启用" : "停用"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingScene(scene)}
                              >
                                配置
                              </Button>
                              <SceneTestButton scene={scene} />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    {!scenesQuery.isLoading && !scenesQuery.isError && !scenes.length && (
                      <TableRow>
                        <TableCell colSpan={4}>
                          <InlineState
                            title="暂无通知场景"
                            description="系统会在首次访问时初始化默认通知场景。"
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bell className="size-4" />
                  渠道状态
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {channelsQuery.isLoading && <InlineState rows={3} />}
                {channelsQuery.isError && (
                  <InlineState title="渠道状态加载失败" description="请检查通知服务或稍后刷新。" />
                )}
                {!channelsQuery.isLoading &&
                  !channelsQuery.isError &&
                  (channelsQuery.data || []).map((channel) => (
                    <ChannelCard key={channel.channel} channel={channel} />
                  ))}
              </CardContent>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">最近投递</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>场景/用户</TableHead>
                    <TableHead>来源</TableHead>
                    <TableHead>渠道</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>次数</TableHead>
                    <TableHead>结果</TableHead>
                    <TableHead>时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveriesQuery.isLoading &&
                    Array.from({ length: 4 }).map((_, index) => (
                      <TableRow key={`delivery-loading-${index}`}>
                        <TableCell colSpan={7}>
                          <InlineState rows={1} />
                        </TableCell>
                      </TableRow>
                    ))}
                  {deliveriesQuery.isError && (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <InlineState
                          title="投递记录加载失败"
                          description="投递日志暂时不可用，请稍后重试。"
                        />
                      </TableCell>
                    </TableRow>
                  )}
                  {!deliveriesQuery.isLoading &&
                    !deliveriesQuery.isError &&
                    (deliveriesQuery.data?.items || []).map((item) => (
                      <DeliveryRow key={item.id} item={item} />
                    ))}
                  {!deliveriesQuery.isLoading &&
                    !deliveriesQuery.isError &&
                    !deliveriesQuery.data?.items?.length && (
                      <TableRow>
                        <TableCell colSpan={7}>
                          <InlineState
                            title="暂无投递记录"
                            description="发送测试通知或业务通知后会在这里看到渠道结果。"
                          />
                        </TableCell>
                      </TableRow>
                    )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <SceneEditor
        scene={editingScene}
        open={Boolean(editingScene)}
        onOpenChange={(open) => {
          if (!open) setEditingScene(null);
        }}
      />
    </PageContainer>
  );
}
