import { useDocumentHead } from "@buildingai/hooks";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@buildingai/ui/components/ui/select";
import { Save } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
    useConsoleVideoModelConfigsQuery,
    useConsoleVideoPoliciesQuery,
    useUpsertGlobalVideoPolicyMutation,
    useUpsertModelVideoPolicyMutation,
} from "../../services";
import type { SaveVideoPolicyParams, VideoPolicyConfig } from "../../services/types/generation";
import { VideoPolicyScope } from "../../services/types/generation";

export default function ConsoleVideoPoliciesPage() {
    useDocumentHead({ title: "视频风控限流" });
    const { data: policies = [], refetch } = useConsoleVideoPoliciesQuery();
    const { data: modelConfigs } = useConsoleVideoModelConfigsQuery({ page: 1, pageSize: 100 });
    const globalMutation = useUpsertGlobalVideoPolicyMutation();
    const modelMutation = useUpsertModelVideoPolicyMutation();
    const [selectedModelId, setSelectedModelId] = useState("global");

    const models = modelConfigs?.items ?? [];
    const selectedPolicy = useMemo(() => {
        if (selectedModelId === "global") {
            return policies.find((item) => item.scope === VideoPolicyScope.GLOBAL);
        }
        return policies.find((item) => item.scope === VideoPolicyScope.MODEL && item.modelConfigId === selectedModelId);
    }, [policies, selectedModelId]);

    const handleSave = async (form: SaveVideoPolicyParams) => {
        try {
            if (selectedModelId === "global") {
                await globalMutation.mutateAsync(form);
            } else {
                await modelMutation.mutateAsync({ modelConfigId: selectedModelId, data: form });
            }
            toast.success("策略已保存");
            refetch();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "保存失败");
        }
    };

    return (
        <div className="space-y-5 p-4 md:p-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">风控限流</h1>
                <p className="text-muted-foreground mt-1 text-sm">控制提示词长度、素材数量、并发任务和每日提交上限。</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
                <Card>
                    <CardHeader>
                        <CardTitle>策略范围</CardTitle>
                        <CardDescription>模型策略会覆盖全局策略。</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Select value={selectedModelId} onValueChange={setSelectedModelId}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="global">全局默认策略</SelectItem>
                                {models.map((model) => (
                                    <SelectItem key={model.id} value={model.id}>{model.displayName}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="text-muted-foreground text-xs">
                            已配置 {policies.length} 条策略。未配置时使用后端默认策略。
                        </div>
                    </CardContent>
                </Card>
                <PolicyEditor
                    key={`${selectedModelId}-${selectedPolicy?.updatedAt ?? "draft"}`}
                    value={selectedPolicy}
                    onSave={handleSave}
                />
            </div>
        </div>
    );
}

function PolicyEditor({ value, onSave }: { value?: VideoPolicyConfig; onSave: (data: SaveVideoPolicyParams) => void }) {
    const [maxPromptLength, setMaxPromptLength] = useState(String(value?.maxPromptLength ?? 4000));
    const [maxMediaItemsPerRequest, setMaxMediaItemsPerRequest] = useState(String(value?.maxMediaItemsPerRequest ?? 5));
    const [maxReferenceImages, setMaxReferenceImages] = useState(String(value?.maxReferenceImages ?? 4));
    const [maxVideoSizeMb, setMaxVideoSizeMb] = useState(String(value?.maxVideoSizeMb ?? 300));
    const [maxImageSizeMb, setMaxImageSizeMb] = useState(String(value?.maxImageSizeMb ?? 20));
    const [maxConcurrentJobsPerUser, setMaxConcurrentJobsPerUser] = useState(String(value?.maxConcurrentJobsPerUser ?? 3));
    const [dailyJobsPerUser, setDailyJobsPerUser] = useState(String(value?.dailyJobsPerUser ?? 100));
    const [allowPublicMediaUrl, setAllowPublicMediaUrl] = useState(value?.allowPublicMediaUrl === true);
    const [enabled, setEnabled] = useState(value?.enabled ?? true);

    return (
        <Card>
            <CardHeader>
                <CardTitle>策略编辑</CardTitle>
                <CardDescription>保存后新提交任务立即按策略校验。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                    <NumberField label="最大提示词长度" value={maxPromptLength} onChange={setMaxPromptLength} />
                    <NumberField label="单次最大素材数" value={maxMediaItemsPerRequest} onChange={setMaxMediaItemsPerRequest} />
                    <NumberField label="最大参考图数" value={maxReferenceImages} onChange={setMaxReferenceImages} />
                    <NumberField label="视频大小上限 MB" value={maxVideoSizeMb} onChange={setMaxVideoSizeMb} />
                    <NumberField label="图片大小上限 MB" value={maxImageSizeMb} onChange={setMaxImageSizeMb} />
                    <NumberField label="用户并发任务数" value={maxConcurrentJobsPerUser} onChange={setMaxConcurrentJobsPerUser} />
                    <NumberField label="用户每日任务数" value={dailyJobsPerUser} onChange={setDailyJobsPerUser} />
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                    <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                        <input type="checkbox" checked={allowPublicMediaUrl} onChange={(event) => setAllowPublicMediaUrl(event.target.checked)} />
                        允许外部媒体 URL
                    </label>
                    <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
                        启用策略
                    </label>
                </div>
                <div className="flex justify-end">
                    <Button onClick={() => onSave({
                        maxPromptLength: Number(maxPromptLength || 4000),
                        maxMediaItemsPerRequest: Number(maxMediaItemsPerRequest || 5),
                        maxReferenceImages: Number(maxReferenceImages || 4),
                        maxVideoSizeMb: Number(maxVideoSizeMb || 300),
                        maxImageSizeMb: Number(maxImageSizeMb || 20),
                        maxConcurrentJobsPerUser: Number(maxConcurrentJobsPerUser || 3),
                        dailyJobsPerUser: Number(dailyJobsPerUser || 100),
                        allowPublicMediaUrl,
                        enabled,
                    })}>
                        <Save className="size-4" />
                        保存策略
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <Input type="number" min={0} value={value} onChange={(event) => onChange(event.target.value)} />
        </div>
    );
}
