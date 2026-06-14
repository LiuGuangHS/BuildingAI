import { useDocumentHead } from "@buildingai/hooks";
import { Button } from "@buildingai/ui/components/ui/button";
import { Input } from "@buildingai/ui/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@buildingai/ui/components/ui/select";
import { usePagination } from "@buildingai/ui/hooks/use-pagination";
import { ListFilter, RotateCcw, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ErrorState } from "../components/error-state";
import { HistoryList } from "../components/history-list";
import {
    useWebDeleteGenerationMutation,
    useWebGenerationListQuery,
    useWebRetryGenerationMutation,
} from "../services";
import { ImageGenerationStatus, type QueryGenerationParams } from "../services/types/generation";

export default function HistoryPage() {
    useDocumentHead({ title: "AI图像工作台生成历史" });

    const [params, setParams] = useState<QueryGenerationParams>({ page: 1, pageSize: 12 });
    const { data, isLoading, isError, refetch } = useWebGenerationListQuery(params);
    const deleteMutation = useWebDeleteGenerationMutation();
    const retryMutation = useWebRetryGenerationMutation();
    const hasFilters = Boolean(params.keyword || params.status);

    const { PaginationComponent } = usePagination({
        total: data?.total || 0,
        page: params.page || 1,
        pageSize: params.pageSize || 12,
        onPageChange: (page) => setParams((prev) => ({ ...prev, page })),
    });

    const handleDelete = async (id: string) => {
        await deleteMutation.mutateAsync(id);
        toast.success("删除成功");
        refetch();
    };

    const handleRetry = async (id: string) => {
        try {
            await retryMutation.mutateAsync(id);
            toast.success("重新生成成功");
            refetch();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "重新生成失败");
        }
    };

    const handleResetFilters = () => {
        setParams((prev) => ({ page: 1, pageSize: prev.pageSize || 12 }));
    };

    return (
        <div className="space-y-6 p-4 md:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">生成历史</h1>
                    <p className="text-muted-foreground mt-1 text-sm">检索和管理你的 AI 图像生成记录。</p>
                </div>
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <ListFilter className="size-4" />
                    {isLoading ? "正在加载记录" : `共 ${data?.total || 0} 条记录`}
                </div>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border bg-background p-4 md:flex-row md:items-center">
                <div className="relative flex-1">
                    <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                    <Input
                        className="pl-9"
                        placeholder="搜索提示词..."
                        value={params.keyword || ""}
                        onChange={(event) =>
                            setParams((prev) => ({ ...prev, keyword: event.target.value, page: 1 }))
                        }
                        onKeyDown={(event) => event.key === "Enter" && refetch()}
                    />
                </div>
                <Select
                    value={params.status || "all"}
                    onValueChange={(value) =>
                        setParams((prev) => ({
                            ...prev,
                            status: value === "all" ? undefined : (value as ImageGenerationStatus),
                            page: 1,
                        }))
                    }
                >
                    <SelectTrigger className="w-full md:w-44">
                        <SelectValue placeholder="状态" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">全部状态</SelectItem>
                        <SelectItem value={ImageGenerationStatus.PENDING}>待处理</SelectItem>
                        <SelectItem value={ImageGenerationStatus.SUCCEEDED}>成功</SelectItem>
                        <SelectItem value={ImageGenerationStatus.FAILED}>失败</SelectItem>
                        <SelectItem value={ImageGenerationStatus.PROCESSING}>生成中</SelectItem>
                    </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => refetch()}>
                    <Search className="size-4" />
                    搜索
                </Button>
                <Button variant="ghost" disabled={!hasFilters} onClick={handleResetFilters}>
                    <RotateCcw className="size-4" />
                    重置
                </Button>
            </div>

            {isError ? (
                <ErrorState title="加载历史失败" message="无法获取生成记录，请检查网络后重试" onRetry={() => refetch()} />
            ) : (
                <>
                    <HistoryList
                        title="全部作品"
                        description="按提示词和状态检索你的生成记录"
                        items={data?.items || []}
                        loading={isLoading}
                        detailBasePath="."
                        onDelete={handleDelete}
                        onRetry={handleRetry}
                    />
                    {PaginationComponent}
                </>
            )}
        </div>
    );
}
