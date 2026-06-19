import { useDocumentHead } from "@buildingai/hooks";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { BarChart3, Coins, History, ImageIcon, Shield, Sparkles, Settings2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useConsoleBillingRulesQuery, useConsoleModelConfigsQuery, useGenerationListQuery, useConsoleTemplatesQuery } from "../../services";

export default function EchoflowImageConsolePage() {
    useDocumentHead({ title: "AI图像工作台管理" });
    const navigate = useNavigate();
    const { data: models } = useConsoleModelConfigsQuery({ page: 1, pageSize: 50 });
    const { data: rules } = useConsoleBillingRulesQuery({ page: 1, pageSize: 50 });
    const { data: templates } = useConsoleTemplatesQuery({ page: 1, pageSize: 50 });
    const { data: history } = useGenerationListQuery({ page: 1, pageSize: 20 });

    const historyItems = history?.items ?? [];
    const succeeded = historyItems.filter((item) => item.status === "succeeded").length;
    const failed = historyItems.filter((item) => item.status === "failed").length;
    const processing = historyItems.filter((item) => item.status === "processing" || item.status === "pending").length;
    const power = historyItems.reduce((sum, item) => sum + Number(item.billingAmount || 0), 0);

    return (
        <div className="space-y-6 p-4 md:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <Badge variant="secondary" className="mb-2">Console</Badge>
                    <h1 className="text-2xl font-semibold tracking-tight">AI图像工作台运营台</h1>
                    <p className="text-muted-foreground text-sm">固定绘画模型绑定主站密钥，模型配置页统一维护接入、计费、风控、模板和全量生成任务。</p>
                </div>
                <Button onClick={() => navigate("/console/models")}>
                    <Settings2 className="size-4" />
                    模型配置
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Metric title="启用模型" value={models?.items?.filter((item) => item.enabled).length ?? 0} icon={<ImageIcon className="size-4" />} />
                <Metric title="计费规则" value={rules?.items?.length ?? 0} icon={<Coins className="size-4" />} />
                <Metric title="模板预设" value={templates?.items?.filter((item) => item.enabled).length ?? 0} icon={<Sparkles className="size-4" />} />
                <Metric title="近期算力" value={power} icon={<BarChart3 className="size-4" />} />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
                <Card>
                    <CardHeader>
                        <CardTitle>近期任务</CardTitle>
                        <CardDescription>最近 20 条生成任务状态概览。</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-3">
                        <Metric title="成功" value={succeeded} icon={<Sparkles className="size-4" />} compact />
                        <Metric title="处理中" value={processing} icon={<History className="size-4" />} compact />
                        <Metric title="失败" value={failed} icon={<Shield className="size-4" />} compact />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>配置清单</CardTitle>
                        <CardDescription>模型接入、风控、模板和任务审计集中维护。</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <QuickAction label="模型配置" onClick={() => navigate("/console/models")} />
                        <QuickAction label="风控限流" onClick={() => navigate("/console/policies")} />
                        <QuickAction label="模板预设" onClick={() => navigate("/console/templates")} />
                        <QuickAction label="任务历史" onClick={() => navigate("/console/history")} />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function Metric({ title, value, icon, compact }: { title: string; value: number; icon: React.ReactNode; compact?: boolean }) {
    return (
        <Card className={compact ? "border-dashed" : undefined}>
            <CardContent className={compact ? "p-4" : "p-5"}>
                <div className="text-muted-foreground flex items-center gap-2 text-sm">{icon}{title}</div>
                <div className="mt-2 text-2xl font-semibold">{value}</div>
            </CardContent>
        </Card>
    );
}

function QuickAction({ label, onClick }: { label: string; onClick: () => void }) {
    return <Button variant="outline" className="w-full justify-start" onClick={onClick}>{label}</Button>;
}
