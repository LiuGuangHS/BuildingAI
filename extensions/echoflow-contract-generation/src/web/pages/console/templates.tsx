import { useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@buildingai/ui/components/ui/alert-dialog";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { safeJsonParse } from "@buildingai/stores";

import { useAdminContractTemplatesQuery, useCreateAdminContractTemplateMutation, useDeleteAdminContractTemplateMutation, useOfflineAdminContractTemplateMutation, usePublishAdminContractTemplateMutation, useResetBuiltinContractTemplatesMutation, useUpdateAdminContractTemplateMutation } from "../../services/console";
import type { AdminContractTemplate, UpsertContractTemplateParams } from "../../services/types";

const emptyTemplate: UpsertContractTemplateParams = {
    name: "",
    industry: "通用法务",
    contractType: "custom",
    description: "",
    fields: [{ key: "partyA", label: "甲方", type: "text", required: true }, { key: "partyB", label: "乙方", type: "text", required: true }],
    defaultSections: ["合同主体", "合同内容", "费用与付款", "违约责任", "争议解决"],
    promptTemplate: "",
    sortOrder: 0,
};

export default function ContractTemplatesConsolePage() {
    const { data: templates = [] } = useAdminContractTemplatesQuery();
    const createMutation = useCreateAdminContractTemplateMutation();
    const updateMutation = useUpdateAdminContractTemplateMutation();
    const deleteMutation = useDeleteAdminContractTemplateMutation();
    const publishMutation = usePublishAdminContractTemplateMutation();
    const offlineMutation = useOfflineAdminContractTemplateMutation();
    const resetMutation = useResetBuiltinContractTemplatesMutation();
    const [editing, setEditing] = useState<AdminContractTemplate | null>(null);
    const [form, setForm] = useState<UpsertContractTemplateParams>(emptyTemplate);
    const [fieldsText, setFieldsText] = useState(JSON.stringify(emptyTemplate.fields, null, 2));
    const [sectionsText, setSectionsText] = useState(emptyTemplate.defaultSections.join("\n"));
    const [message, setMessage] = useState("");
    const publishedCount = useMemo(() => templates.filter((template) => template.status === "published").length, [templates]);

    useEffect(() => {
        if (!editing) return;
        const nextForm = toForm(editing);
        setForm(nextForm);
        setFieldsText(JSON.stringify(nextForm.fields, null, 2));
        setSectionsText(nextForm.defaultSections.join("\n"));
        setMessage("");
    }, [editing]);

    function startCreate() {
        setEditing(null);
        setForm(emptyTemplate);
        setFieldsText(JSON.stringify(emptyTemplate.fields, null, 2));
        setSectionsText(emptyTemplate.defaultSections.join("\n"));
        setMessage("");
    }

    async function handleSubmit() {
        const fields = parseFields(fieldsText);
        if (!fields) {
            setMessage("字段配置必须是 JSON 数组");
            return;
        }
        const params: UpsertContractTemplateParams = { ...form, fields, defaultSections: sectionsText.split("\n").map((item) => item.trim()).filter(Boolean) };
        try {
            if (editing?.id) {
                await updateMutation.mutateAsync({ id: editing.id, params });
                setMessage("模板已保存");
            } else {
                const created = await createMutation.mutateAsync(params);
                setEditing(created);
                setMessage("模板已创建");
            }
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "保存失败");
        }
    }

    async function handleDelete(template: AdminContractTemplate) {
        try {
            await deleteMutation.mutateAsync(template.id);
            if (editing?.id === template.id) startCreate();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "删除失败");
        }
    }

    async function handleLifecycle(template: AdminContractTemplate, action: "publish" | "offline") {
        try {
            if (action === "publish") await publishMutation.mutateAsync(template.id);
            else await offlineMutation.mutateAsync(template.id);
            setMessage(action === "publish" ? "模板已发布" : "模板已下线");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "更新发布状态失败");
        }
    }

    async function handleResetBuiltin() {
        try {
            await resetMutation.mutateAsync();
            setMessage("内置模板已同步");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "同步失败");
        }
    }

    function formatFieldsJson() {
        const fields = parseFields(fieldsText);
        if (!fields) {
            setMessage("字段配置必须是 JSON 数组");
            return;
        }
        setFieldsText(JSON.stringify(fields, null, 2));
        setMessage("字段 JSON 已格式化");
    }

    return (
        <main className="ec-console-page">
            <header className="ec-console-header">
                <div>
                    <p className="ec-console-kicker">AI 合同管理</p>
                    <h1>合同模板</h1>
                    <p>维护用户端可选模板、字段结构、默认条款和生成提示。</p>
                </div>
                <div className="ec-header-actions">
                    <Button variant="outline" onClick={handleResetBuiltin} disabled={resetMutation.isPending}>同步内置模板</Button>
                    <Button onClick={startCreate}>新增模板</Button>
                </div>
            </header>

            <section className="ec-template-layout">
                <Card className="ec-list-panel">
                    <CardHeader>
                        <CardTitle>模板列表</CardTitle>
                        <CardDescription>共 {templates.length} 个，已发布 {publishedCount} 个</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                        {templates.map((template) => (
                            <Button key={template.id} variant="outline" className="ec-template-item" data-selected={editing?.id === template.id} onClick={() => setEditing(template)} type="button">
                                <div className="ec-template-item-head">
                                    <div className="min-w-0">
                                        <strong>{template.name}</strong>
                                        <span>{template.industry} / {template.contractType}</span>
                                    </div>
                                    <div className="flex shrink-0 gap-2">
                                        <Badge variant={template.status === "published" ? "default" : "outline"}>{template.status === "published" ? "已发布" : template.status === "offline" ? "已下线" : "草稿"}</Badge>
                                        <Badge variant="outline">v{template.versionNo}</Badge>
                                        {template.isBuiltin ? <Badge variant="outline">内置</Badge> : null}
                                    </div>
                                </div>
                                <p>{template.description}</p>
                            </Button>
                        ))}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <CardTitle>{editing ? editing.name : "新增模板"}</CardTitle>
                                <CardDescription>{editing ? "编辑当前模板配置" : "创建一个新的合同生成模板"}</CardDescription>
                            </div>
                            {message ? <Badge variant={message.includes("失败") || message.includes("不正确") ? "destructive" : "default"}>{message}</Badge> : null}
                        </div>
                    </CardHeader>
                    <CardContent className="grid gap-6">

                        <div className="ec-form-grid">
                            <Field label="模板名称" value={form.name} onChange={(name) => setForm({ ...form, name })} />
                            <Field label="行业" value={form.industry} onChange={(industry) => setForm({ ...form, industry })} />
                            <Field label="合同类型" value={form.contractType} onChange={(contractType) => setForm({ ...form, contractType })} />
                            <Field label="排序" type="number" value={String(form.sortOrder ?? 0)} onChange={(value) => setForm({ ...form, sortOrder: Number(value) || 0 })} />
                        </div>

                        <TextareaField label="描述" value={form.description} onChange={(value) => setForm({ ...form, description: value })} />

                    <details className="ec-advanced-panel">
                        <summary>高级配置</summary>
                        <div className="grid gap-5 pt-4">
                            <section className="grid gap-3">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div>
                                        <h3 className="text-base font-medium">字段 JSON</h3>
                                        <p className="text-sm text-muted-foreground">字段会渲染为用户端填写表单。结构错误时后端会拒绝保存。</p>
                                    </div>
                                    <Button variant="outline" onClick={formatFieldsJson}>格式化</Button>
                                </div>
                                <Textarea className="min-h-40 font-mono text-xs" value={fieldsText} onChange={(event) => setFieldsText(event.target.value)} aria-label="字段 JSON" />
                            </section>

                            <section className="grid gap-2">
                                <h3 className="text-base font-medium">默认条款</h3>
                                <Textarea className="min-h-32" value={sectionsText} onChange={(event) => setSectionsText(event.target.value)} aria-label="默认条款" />
                                <p className="text-sm text-muted-foreground">每行一条，生成合同时作为默认条款结构。</p>
                            </section>

                            <section className="grid gap-2">
                                <h3 className="text-base font-medium">AI 提示</h3>
                                <Textarea className="min-h-32" value={form.promptTemplate ?? ""} onChange={(event) => setForm({ ...form, promptTemplate: event.target.value })} aria-label="AI 提示" />
                                <p className="text-sm text-muted-foreground">用于约束生成风格、输出边界和业务注意事项。</p>
                            </section>
                        </div>
                    </details>

                    {editing && (
                        <section className="flex flex-wrap items-center justify-between gap-4 rounded-md border p-4">
                            <div>
                                <h3 className="text-base font-medium">发布状态</h3>
                                <p className="text-sm text-muted-foreground">当前为 {editing.status === "published" ? "已发布" : editing.status === "offline" ? "已下线" : "草稿"} v{editing.versionNo}；已发布或已使用版本保存后会产生新草稿版本。</p>
                            </div>
                            <div className="flex gap-2">
                                {editing.status !== "published" && <Button variant="outline" onClick={() => handleLifecycle(editing, "publish")} disabled={publishMutation.isPending}>发布</Button>}
                                {editing.status === "published" && <Button variant="outline" onClick={() => handleLifecycle(editing, "offline")} disabled={offlineMutation.isPending}>下线</Button>}
                            </div>
                        </section>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                        {editing ? (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" disabled={deleteMutation.isPending}>删除模板</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>删除模板</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            确定删除模板“{editing.name}”吗？历史任务会继续保留模板快照。
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>取消</AlertDialogCancel>
                                        <AlertDialogAction variant="destructive" onClick={() => handleDelete(editing)}>
                                            确认删除
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        ) : null}
                        <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} loading={createMutation.isPending || updateMutation.isPending}>
                            {editing ? "保存模板" : "创建模板"}
                        </Button>
                    </div>
                    </CardContent>
                </Card>
            </section>
        </main>
    );
}

function toForm(template: AdminContractTemplate): UpsertContractTemplateParams {
    return { name: template.name, industry: template.industry, contractType: template.contractType, description: template.description, fields: template.fields, defaultSections: template.defaultSections, promptTemplate: template.promptTemplate ?? "", sortOrder: template.sortOrder ?? 0 };
}

function parseFields(value: string) {
    const fields = safeJsonParse<UpsertContractTemplateParams["fields"]>(value);
    return Array.isArray(fields) ? fields : undefined;
}

function Field({ label, type = "text", value, onChange }: { label: string; type?: string; value: string; onChange: (value: string) => void }) {
    const id = useId();
    return (
        <div className="grid gap-2">
            <Label htmlFor={id}>{label}</Label>
            <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
        </div>
    );
}

function TextareaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
    const id = useId();
    return (
        <div className="grid gap-2">
            <Label htmlFor={id}>{label}</Label>
            <Textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} />
        </div>
    );
}
