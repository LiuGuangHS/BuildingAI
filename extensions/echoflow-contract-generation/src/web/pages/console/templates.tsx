import { useEffect, useMemo, useState } from "react";
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
import { Switch } from "@buildingai/ui/components/ui/switch";
import { Textarea } from "@buildingai/ui/components/ui/textarea";

import { useAdminContractTemplatesQuery, useCreateAdminContractTemplateMutation, useDeleteAdminContractTemplateMutation, useResetBuiltinContractTemplatesMutation, useUpdateAdminContractTemplateMutation } from "../../services/console";
import type { ContractTemplate, UpsertContractTemplateParams } from "../../services/types";

const emptyTemplate: UpsertContractTemplateParams = {
    name: "",
    industry: "通用法务",
    contractType: "custom",
    description: "",
    fields: [{ key: "partyA", label: "甲方", type: "text", required: true }, { key: "partyB", label: "乙方", type: "text", required: true }],
    defaultSections: ["合同主体", "合同内容", "费用与付款", "违约责任", "争议解决"],
    promptTemplate: "",
    isActive: true,
    sortOrder: 0,
};

export default function ContractTemplatesConsolePage() {
    const { data: templates = [] } = useAdminContractTemplatesQuery();
    const createMutation = useCreateAdminContractTemplateMutation();
    const updateMutation = useUpdateAdminContractTemplateMutation();
    const deleteMutation = useDeleteAdminContractTemplateMutation();
    const resetMutation = useResetBuiltinContractTemplatesMutation();
    const [editing, setEditing] = useState<ContractTemplate | null>(null);
    const [form, setForm] = useState<UpsertContractTemplateParams>(emptyTemplate);
    const [fieldsText, setFieldsText] = useState(JSON.stringify(emptyTemplate.fields, null, 2));
    const [sectionsText, setSectionsText] = useState(emptyTemplate.defaultSections.join("\n"));
    const [message, setMessage] = useState("");
    const activeCount = useMemo(() => templates.filter((template) => template.isActive).length, [templates]);

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
        let fields: UpsertContractTemplateParams["fields"];
        try {
            fields = JSON.parse(fieldsText);
            if (!Array.isArray(fields)) throw new Error("字段配置必须是 JSON 数组");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "字段配置 JSON 不正确");
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

    async function handleDelete(template: ContractTemplate) {
        await deleteMutation.mutateAsync(template.id);
        if (editing?.id === template.id) startCreate();
    }

    async function handleResetBuiltin() {
        await resetMutation.mutateAsync();
        setMessage("内置模板已同步");
    }

    function formatFieldsJson() {
        try {
            setFieldsText(JSON.stringify(JSON.parse(fieldsText), null, 2));
            setMessage("字段 JSON 已格式化");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "字段配置 JSON 不正确");
        }
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
                        <CardDescription>共 {templates.length} 个，启用 {activeCount} 个</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                        {templates.map((template) => (
                            <Button key={template.id} variant={editing?.id === template.id ? "secondary" : "outline"} className="h-auto w-full justify-start p-3 text-left" onClick={() => setEditing(template)} type="button">
                                <div>
                                    <strong className="block">{template.name}</strong>
                                    <span className="block text-xs text-muted-foreground">{template.industry} / {template.contractType}</span>
                                </div>
                                <p className="my-2 line-clamp-2 text-left text-xs text-muted-foreground">{template.description}</p>
                                <div className="flex gap-2">
                                    <Badge variant={template.isActive ? "default" : "outline"}>{template.isActive ? "启用" : "停用"}</Badge>
                                    {template.isBuiltin ? <Badge variant="outline">内置</Badge> : null}
                                </div>
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

                    <div className="grid gap-2">
                        <Label>描述</Label>
                        <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                    </div>

                    <section className="grid gap-3">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <h3 className="text-base font-medium">高级字段 JSON</h3>
                                <p className="text-sm text-muted-foreground">字段会渲染为用户端填写表单。结构错误时后端会拒绝保存。</p>
                            </div>
                            <Button variant="outline" onClick={formatFieldsJson}>格式化</Button>
                        </div>
                        <Textarea className="min-h-40 font-mono text-xs" value={fieldsText} onChange={(event) => setFieldsText(event.target.value)} />
                    </section>

                    <section className="grid gap-2">
                        <h3 className="text-base font-medium">默认条款</h3>
                        <Textarea className="min-h-40" value={sectionsText} onChange={(event) => setSectionsText(event.target.value)} />
                        <p className="text-sm text-muted-foreground">每行一条，生成合同时作为默认条款结构。</p>
                    </section>

                    <section className="grid gap-2">
                        <h3 className="text-base font-medium">AI 提示</h3>
                        <Textarea className="min-h-40" value={form.promptTemplate ?? ""} onChange={(event) => setForm({ ...form, promptTemplate: event.target.value })} />
                        <p className="text-sm text-muted-foreground">用于约束生成风格、输出边界和业务注意事项。</p>
                    </section>

                    <section className="flex items-center justify-between gap-4 rounded-md border p-4">
                        <div>
                            <h3 className="text-base font-medium">发布状态</h3>
                            <p className="text-sm text-muted-foreground">启用后用户端可以选择该模板。</p>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <Switch checked={form.isActive ?? true} onCheckedChange={(checked) => setForm({ ...form, isActive: checked })} />
                            启用模板
                        </div>
                    </section>

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

function toForm(template: ContractTemplate): UpsertContractTemplateParams {
    return { name: template.name, industry: template.industry, contractType: template.contractType, description: template.description, fields: template.fields, defaultSections: template.defaultSections, promptTemplate: template.promptTemplate ?? "", isActive: template.isActive ?? true, sortOrder: template.sortOrder ?? 0 };
}

function Field({ label, type = "text", value, onChange }: { label: string; type?: string; value: string; onChange: (value: string) => void }) {
    return (
        <div className="grid gap-2">
            <Label>{label}</Label>
            <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
        </div>
    );
}
