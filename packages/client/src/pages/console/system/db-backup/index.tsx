import {
    useBackupConfigQuery,
    useBackupListQuery,
    useCreateBackupMutation,
    useDeleteBackupMutation,
    useUpdateBackupConfigMutation,
    type BackupConfig,
} from "@buildingai/services/console";
import { PermissionGuard } from "@buildingai/ui/components/auth/permission-guard";
import { Button } from "@buildingai/ui/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@buildingai/ui/components/ui/card";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@buildingai/ui/components/ui/alert-dialog";
import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
} from "@buildingai/ui/components/ui/field";
import { Input } from "@buildingai/ui/components/ui/input";
import { Switch } from "@buildingai/ui/components/ui/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@buildingai/ui/components/ui/table";
import {
    CheckCircle2,
    Clock,
    Database,
    Loader2,
    Play,
    Save,
    Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageContainer } from "@/layouts/console/_components/page-container";

const DEFAULT_CONFIG: BackupConfig = {
    enabled: false,
    schedule: "0 2 * * *",
    retentionDays: 7,
};

const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
};

const SystemDbBackupIndexPage = () => {
    const { data: configData, isLoading: configLoading } = useBackupConfigQuery();
    const { data: backups, isLoading: backupsLoading } = useBackupListQuery();
    const updateConfigMutation = useUpdateBackupConfigMutation();
    const createBackupMutation = useCreateBackupMutation();
    const deleteBackupMutation = useDeleteBackupMutation();

    const [form, setForm] = useState<BackupConfig>(DEFAULT_CONFIG);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

    const savedConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...configData }), [configData]);

    useEffect(() => {
        if (configData) {
            setForm({ ...DEFAULT_CONFIG, ...configData });
        }
    }, [configData]);

    const updateForm = <K extends keyof BackupConfig>(key: K, value: BackupConfig[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleSaveConfig = () => {
        if (!Number.isInteger(form.retentionDays) || form.retentionDays < 1 || form.retentionDays > 365) {
            toast.error("保留天数必须是 1 到 365 之间的整数");
            return;
        }
        updateConfigMutation.mutate({ enabled: form.enabled, retentionDays: form.retentionDays }, {
            onSuccess: () => {
                toast.success("备份配置已保存");
            },
            onError: (e) => {
                toast.error(`保存失败: ${e.message}`);
            },
        });
    };

    const handleCreateBackup = () => {
        createBackupMutation.mutate(undefined, {
            onSuccess: (result) => {
                toast.success(`备份成功: ${result.filename} (${formatSize(result.size)})`);
            },
            onError: (e) => {
                toast.error(`备份失败: ${e.message}`);
            },
        });
    };

    const handleDelete = (filename: string) => {
        deleteBackupMutation.mutate(filename, {
            onSuccess: () => {
                toast.success("备份已删除");
                setDeleteTarget(null);
            },
            onError: (e) => {
                toast.error(`删除失败: ${e.message}`);
            },
        });
    };

    const isBusy =
        updateConfigMutation.isPending || createBackupMutation.isPending || deleteBackupMutation.isPending;

    if (configLoading || backupsLoading) {
        return (
            <PageContainer>
                <div className="flex items-center py-12">
                    <Loader2 className="text-muted-foreground size-8 animate-spin" />
                </div>
            </PageContainer>
        );
    }

    return (
        <PageContainer>
            <PermissionGuard permissions="system:backup:list">
                <div className="space-y-6 px-3">
                    <div className="flex flex-col gap-4 rounded-lg border bg-[linear-gradient(135deg,hsl(var(--muted))_0%,hsl(var(--background))_58%,hsl(var(--accent))_100%)] p-5 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Database className="text-primary size-5" />
                                <h1 className="text-2xl font-semibold">数据库备份</h1>
                            </div>
                            <p className="text-muted-foreground max-w-2xl text-sm">
                                自动备份 PostgreSQL 数据库，备份文件为 gzip 压缩的 SQL 格式，保留在服务器 backups 目录
                            </p>
                        </div>
                        <PermissionGuard permissions="system:backup:create">
                            <Button onClick={handleCreateBackup} disabled={isBusy}>
                                {createBackupMutation.isPending ? (
                                    <Loader2 className="mr-2 size-4 animate-spin" />
                                ) : (
                                    <Play className="mr-2 size-4" />
                                )}
                                立即备份
                            </Button>
                        </PermissionGuard>
                    </div>

                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                        <Card className="rounded-lg">
                            <CardHeader>
                                <CardTitle>备份配置</CardTitle>
                                <CardDescription>配置自动备份策略</CardDescription>
                                <div className="flex items-center gap-2">
                                    <Switch
                                        checked={form.enabled}
                                        onCheckedChange={(value) => updateForm("enabled", value)}
                                        disabled={isBusy}
                                    />
                                    <span className="text-sm font-medium">
                                        {form.enabled ? "自动备份已启用" : "自动备份已关闭"}
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <FieldGroup>
                                    <div className="grid gap-5 md:grid-cols-2">
                                        <Field>
                                            <FieldLabel>备份周期</FieldLabel>
                                            <div className="rounded-md border px-3 py-2 text-sm">
                                                每天 02:00 自动备份
                                            </div>
                                            <FieldDescription>固定计划：{form.schedule}，时区 Asia/Shanghai</FieldDescription>
                                        </Field>

                                        <Field>
                                            <FieldLabel>保留天数</FieldLabel>
                                            <Input
                                                type="number"
                                                min={1}
                                                max={365}
                                                value={form.retentionDays}
                                                onChange={(e) =>
                                                    updateForm("retentionDays", Number(e.target.value))
                                                }
                                                disabled={!form.enabled || isBusy}
                                            />
                                            <FieldDescription>自动清理超过指定天数的备份文件</FieldDescription>
                                        </Field>
                                    </div>

                                    <div className="flex flex-wrap gap-3">
                                        <PermissionGuard permissions="system:backup:config">
                                            <Button onClick={handleSaveConfig} disabled={isBusy}>
                                                {updateConfigMutation.isPending ? (
                                                    <Loader2 className="mr-2 size-4 animate-spin" />
                                                ) : (
                                                    <Save className="mr-2 size-4" />
                                                )}
                                                保存配置
                                            </Button>
                                        </PermissionGuard>
                                    </div>
                                </FieldGroup>
                            </CardContent>
                        </Card>

                        <Card className="rounded-lg" size="sm">
                            <CardHeader>
                                <CardTitle>当前状态</CardTitle>
                                <CardDescription>备份配置概览</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className="flex items-center gap-3">
                                    <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-md">
                                        {savedConfig.enabled ? (
                                            <CheckCircle2 className="size-5" />
                                        ) : (
                                            <Clock className="size-5" />
                                        )}
                                    </div>
                                    <div>
                                        <div className="font-medium">
                                            {savedConfig.enabled ? "自动备份已启用" : "自动备份已关闭"}
                                        </div>
                                        <div className="text-muted-foreground text-sm">
                                            {backups?.length ?? 0} 个备份文件
                                        </div>
                                    </div>
                                </div>
                                <dl className="grid grid-cols-[80px_1fr] gap-x-4 gap-y-3 text-sm">
                                    <dt className="text-muted-foreground">周期</dt>
                                    <dd>每天 02:00</dd>
                                    <dt className="text-muted-foreground">保留</dt>
                                    <dd>{savedConfig.retentionDays} 天</dd>
                                    <dt className="text-muted-foreground">压缩</dt>
                                    <dd>gzip 压缩 SQL</dd>
                                    <dt className="text-muted-foreground">时区</dt>
                                    <dd>Asia/Shanghai</dd>
                                </dl>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="rounded-lg">
                        <CardHeader>
                            <CardTitle>备份记录</CardTitle>
                            <CardDescription>所有备份文件列表，最新的排在前面，文件保留在服务器</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {(!backups || backups.length === 0) ? (
                                <div className="text-muted-foreground py-12 text-center">
                                    暂无备份文件，点击「立即备份」创建第一个备份
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>文件名</TableHead>
                                            <TableHead>大小</TableHead>
                                            <TableHead>创建时间</TableHead>
                                            <TableHead className="text-right">操作</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {backups.map((backup) => (
                                            <TableRow key={backup.filename}>
                                                <TableCell className="font-mono text-sm">
                                                    {backup.filename}
                                                </TableCell>
                                                <TableCell>{formatSize(backup.size)}</TableCell>
                                                <TableCell>{formatDate(backup.createdAt)}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <PermissionGuard permissions="system:backup:delete">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => setDeleteTarget(backup.filename)}
                                                                disabled={isBusy}
                                                            >
                                                                <Trash2 className="mr-1 size-4" />
                                                                删除
                                                            </Button>
                                                        </PermissionGuard>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </PermissionGuard>

            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>确认删除备份</AlertDialogTitle>
                        <AlertDialogDescription>
                            确定要删除备份文件 <code className="font-mono">{deleteTarget}</code> 吗？此操作不可撤销。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteBackupMutation.isPending}>取消</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleteTarget && handleDelete(deleteTarget)}
                            disabled={deleteBackupMutation.isPending}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleteBackupMutation.isPending && (
                                <Loader2 className="mr-2 size-4 animate-spin" />
                            )}
                            删除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </PageContainer>
    );
};

export default SystemDbBackupIndexPage;
