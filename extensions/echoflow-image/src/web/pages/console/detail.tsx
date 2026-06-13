import { useDocumentHead } from "@buildingai/hooks";
import { Alert, AlertDescription, AlertTitle } from "@buildingai/ui/components/ui/alert";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { TimeText } from "@buildingai/ui/components/ui/time-text";
import { ArrowLeft, RefreshCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { ConfirmDialog } from "../../components/confirm-dialog";
import { ErrorState } from "../../components/error-state";
import { isSafeImageSrc } from "../../components/image-utils";
import { ResultGallery } from "../../components/result-gallery";
import {
    useDeleteGenerationMutation,
    useGenerationDetailQuery,
    useRetryGenerationMutation,
} from "../../services";
import { ImageGenerationBillingStatus, ImageGenerationStatus } from "../../services/types/generation";

export default function DetailPage() {
    useDocumentHead({ title: "AI图像工作台生成详情" });

    const navigate = useNavigate();
    const { id = "" } = useParams();
    const { data, isLoading, isError, refetch } = useGenerationDetailQuery(id);
    const deleteMutation = useDeleteGenerationMutation();
    const retryMutation = useRetryGenerationMutation();
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const handleDelete = async () => {
        if (!id) return;
        try {
            await deleteMutation.mutateAsync(id);
            toast.success("删除成功");
            navigate("/console/history");
        } catch {
            toast.error("删除失败");
        }
    };

    const handleRetry = async () => {
        if (!id) return;
        try {
            const generation = await retryMutation.mutateAsync(id);
            toast.success("重新生成成功");
            navigate(`/console/history/${generation.id}`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "重新生成失败");
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6 p-4 md:p-6">
                <div className="animate-pulse">
                    <div className="bg-muted mb-4 h-8 w-32 rounded" />
                    <div className="bg-muted mb-2 h-6 w-64 rounded" />
                    <div className="bg-muted mb-6 h-4 w-48 rounded" />
                    <div className="bg-muted h-80 w-full rounded-2xl" />
                </div>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="p-4 md:p-6">
                <ErrorState
                    title="加载详情失败"
                    message="无法获取生成记录详情，请检查后重试"
                    onRetry={() => refetch()}
                />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
                <p className="text-muted-foreground text-lg">记录不存在</p>
                <Button variant="outline" onClick={() => navigate("/console/history")}>
                    <ArrowLeft className="size-4" />
                    返回历史
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-4 md:p-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <Button variant="ghost" className="mb-2 -ml-2" onClick={() => navigate("/console/history")}>
                        <ArrowLeft className="size-4" />
                        返回历史
                    </Button>
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-2xl font-semibold">生成详情</h1>
                        <Badge
                            variant={
                                data.status === ImageGenerationStatus.SUCCEEDED
                                    ? "default"
                                    : data.status === ImageGenerationStatus.FAILED
                                        ? "destructive"
                                        : "secondary"
                            }
                        >
                            {data.status === ImageGenerationStatus.SUCCEEDED ? "成功" :
                             data.status === ImageGenerationStatus.FAILED ? "失败" :
                             data.status === ImageGenerationStatus.PROCESSING ? "生成中" : data.status}
                        </Badge>
                        {data.billingStatus === ImageGenerationBillingStatus.REFUNDED && (
                            <Badge variant="outline">已退款</Badge>
                        )}
                        {data.billingStatus === ImageGenerationBillingStatus.FAILED && (
                            <Badge variant="destructive">扣费失败</Badge>
                        )}
                    </div>
                    <p className="text-muted-foreground mt-1 text-sm">
                        创建于 <TimeText value={data.createdAt} />
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" loading={retryMutation.isPending} onClick={handleRetry}>
                        <RefreshCcw className="size-4" />
                        重试
                    </Button>
                    <Button
                        variant="destructive"
                        loading={deleteMutation.isPending}
                        onClick={() => setShowDeleteConfirm(true)}
                    >
                        <Trash2 className="size-4" />
                        删除
                    </Button>
                </div>
            </div>

            {/* Error message */}
            {data.errorMessage && (
                <Alert variant="destructive">
                    <AlertTitle>生成失败</AlertTitle>
                    <AlertDescription className="whitespace-pre-wrap break-all">
                        {data.errorMessage}
                    </AlertDescription>
                </Alert>
            )}

            {/* Billing warning */}
            {data.status === ImageGenerationStatus.SUCCEEDED &&
                data.billingStatus === ImageGenerationBillingStatus.FAILED && (
                    <Alert>
                        <AlertTitle>扣费异常</AlertTitle>
                        <AlertDescription>
                            图片已生成成功但扣费失败，请联系管理员处理。
                        </AlertDescription>
                    </Alert>
                )}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,0.75fr)_minmax(420px,1fr)]">
                {/* Parameters */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">请求参数</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div>
                                <div className="text-muted-foreground mb-1 text-xs font-medium">提示词</div>
                                <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 leading-relaxed">
                                    {data.prompt}
                                </p>
                            </div>
                            {data.negativePrompt && (
                                <div>
                                    <div className="text-muted-foreground mb-1 text-xs font-medium">反向提示词</div>
                                    <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 leading-relaxed">
                                        {data.negativePrompt}
                                    </p>
                                </div>
                            )}
                            {isSafeImageSrc(data.referenceImageUrl) && (
                                <div>
                                    <div className="text-muted-foreground mb-1 text-xs font-medium">参考图</div>
                                    <img
                                        src={data.referenceImageUrl}
                                        alt="参考图"
                                        className="max-h-72 rounded-xl border object-contain"
                                    />
                                </div>
                            )}
                            <div className="grid gap-3 sm:grid-cols-2">
                                <InfoItem label="用户 ID" value={data.userId} />
                                <InfoItem label="任务 ID" value={data.id} />
                                <InfoItem label="模型" value={data.modelName || data.modelId} />
                                <InfoItem label="Provider" value={data.provider || "-"} />
                                <InfoItem label="尺寸" value={data.size} />
                                <InfoItem label="数量" value={`${data.n}`} />
                                <InfoItem label="质量" value={data.quality || "-"} />
                                <InfoItem label="风格" value={data.style || "-"} />
                                <InfoItem label="返回格式" value={data.responseFormat} />
                                <InfoItem
                                    label="扣费"
                                    value={`${data.billingAmount} 算力${data.billingStatus === ImageGenerationBillingStatus.REFUNDED ? " (已退款)" : ""}`}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Results */}
                <ResultGallery generation={data} />
            </div>

            <ConfirmDialog
                open={showDeleteConfirm}
                title="删除生成记录"
                description="确定要删除这条生成记录吗？此操作不可撤销。"
                confirmText="删除"
                destructive
                loading={deleteMutation.isPending}
                onConfirm={handleDelete}
                onCancel={() => setShowDeleteConfirm(false)}
            />
        </div>
    );
}

function InfoItem({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border bg-background p-3 transition-colors hover:bg-muted/30">
            <div className="text-muted-foreground mb-1 text-xs font-medium">{label}</div>
            <div className="truncate">{value}</div>
        </div>
    );
}
