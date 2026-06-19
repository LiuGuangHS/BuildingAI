import { useDocumentHead } from "@buildingai/hooks";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { Switch } from "@buildingai/ui/components/ui/switch";
import { Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useConsolePoliciesQuery, useUpsertGlobalPolicyMutation } from "../../services";
import type { SavePolicyParams } from "../../services/types/policy";

const defaults = {
    maxPromptLength: 4000,
    maxNegativePromptLength: 2000,
    maxImagesPerRequest: 4,
    maxReferenceImages: 1,
    maxReferenceImageSizeMb: 10,
    maxConcurrentJobsPerUser: 1,
    dailyJobsPerUser: 100,
    allowPublicUrlReference: false,
    enabled: true,
};

export default function ConsolePoliciesPage() {
    useDocumentHead({ title: "绘画风控限流" });
    const { data, refetch } = useConsolePoliciesQuery();
    const global = useMemo(() => data?.find((item) => item.scope === "global"), [data]);
    const mutation = useUpsertGlobalPolicyMutation();
    const [form, setForm] = useState<SavePolicyParams>({ ...defaults, ...(global ?? {}) });

    useEffect(() => {
        setForm({ ...defaults, ...(global ?? {}) });
    }, [global]);

    const setNumber = (key: keyof SavePolicyParams, value: string) => setForm((prev) => ({ ...prev, [key]: Number(value || 0) }));

    return (
        <div className="space-y-5 p-4 md:p-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">风控限流</h1>
                <p className="text-muted-foreground text-sm">控制用户提交规模、并发和每日额度。</p>
            </div>
            <Card className="max-w-3xl">
                <CardHeader>
                    <CardTitle>全局策略</CardTitle>
                    <CardDescription>模型级覆盖策略接口已就绪，首期先维护全局策略。</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                    <Field label="Prompt 最大字数" value={form.maxPromptLength} onChange={(v) => setNumber("maxPromptLength", v)} />
                    <Field label="反向提示词最大字数" value={form.maxNegativePromptLength} onChange={(v) => setNumber("maxNegativePromptLength", v)} />
                    <Field label="单次最大张数" value={form.maxImagesPerRequest} onChange={(v) => setNumber("maxImagesPerRequest", v)} />
                    <Field label="参考图数量" value={form.maxReferenceImages} onChange={(v) => setNumber("maxReferenceImages", v)} />
                    <Field label="参考图大小 MB" value={form.maxReferenceImageSizeMb} onChange={(v) => setNumber("maxReferenceImageSizeMb", v)} />
                    <Field label="用户并发任务" value={form.maxConcurrentJobsPerUser} onChange={(v) => setNumber("maxConcurrentJobsPerUser", v)} />
                    <Field label="每日任务数" value={form.dailyJobsPerUser} onChange={(v) => setNumber("dailyJobsPerUser", v)} />
                    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                        <span>允许外部参考图 URL</span>
                        <Switch
                            checked={form.allowPublicUrlReference === true}
                            onCheckedChange={(checked) => setForm((prev) => ({ ...prev, allowPublicUrlReference: checked }))}
                        />
                    </div>
                    <div className="sm:col-span-2 flex justify-end">
                        <Button onClick={async () => {
                            await mutation.mutateAsync(form);
                            toast.success("策略已保存");
                            refetch();
                        }}>
                            <Save className="size-4" />
                            保存策略
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function Field({ label, value, onChange }: { label: string; value?: number; onChange: (value: string) => void }) {
    return <div className="space-y-2"><Label>{label}</Label><Input type="number" value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} /></div>;
}
