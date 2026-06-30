import { useDocumentHead } from "@buildingai/hooks";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Input } from "@buildingai/ui/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@buildingai/ui/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@buildingai/ui/components/ui/tabs";
import { ArrowLeft, History, SquareStack } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { ErrorState } from "../components/error-state";
import { HistoryList } from "../components/history-list";
import { useWebDeleteVideoMutation, useWebVideoListQuery, useWebVideoModelOptionsQuery } from "../services/web";
import type { VideoGenerationBillingStatus, VideoGenerationStatus } from "../services/types/generation";

export default function WebHistoryPage() {
    useDocumentHead({ title: "我的视频历史 - 视频生成" });
    const navigate = useNavigate();
    const [page, setPage] = useState(1);
    const [keyword, setKeyword] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [modelFilter, setModelFilter] = useState("all");
    const [billingFilter, setBillingFilter] = useState("all");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [sortBy, setSortBy] = useState<"createdAt" | "updatedAt" | "completedAt" | "billingAmount">("createdAt");
    const pageSize = 12;
    const { data: models = [] } = useWebVideoModelOptionsQuery();

    const location = useLocation();
    const tabs = [
        { label: "生成", path: "/" },
        { label: "历史", path: "/history" },
        { label: "短视频", path: "/studio" },
    ] as const;

    const { data, isLoading, isError, refetch } = useWebVideoListQuery({
        page,
        pageSize,
        keyword: keyword || undefined,
        status: statusFilter !== "all" ? (statusFilter as VideoGenerationStatus) : undefined,
        model: modelFilter !== "all" ? modelFilter : undefined,
        billingStatus: billingFilter !== "all" ? (billingFilter as VideoGenerationBillingStatus) : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy,
        sortOrder: "DESC",
    });
    const deleteMutation = useWebDeleteVideoMutation({
        onSuccess: () => {
            toast.success("删除成功");
            refetch();
        },
        onError: (error) => toast.error(error.message || "删除失败"),
    });

    return (
        <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4 p-3 md:p-4">
            <div className="flex flex-col gap-3 rounded-xl border bg-background/85 p-3 shadow-sm md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 space-y-1">
                    <h1 className="truncate text-lg font-semibold tracking-tight md:text-xl">视频历史</h1>
                    <p className="truncate text-sm text-muted-foreground">检索生成记录，复用参数或进入详情。</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Tabs value={activeTabValue(location.pathname)} onValueChange={(value) => navigate(value)}>
                        <TabsList className="h-9" aria-label="视频工作区">
                            {tabs.map((tab) => (
                                <TabsTrigger key={tab.path} value={tab.path} className="gap-1.5 px-3">
                                    {tab.label === "短视频" ? <SquareStack className="size-4" /> : tab.label === "历史" ? <History className="size-4" /> : null}
                                    {tab.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                    <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
                        <ArrowLeft className="size-4" />
                        返回生成
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">筛选</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                    <Input
                        placeholder="搜索提示词..."
                        value={keyword}
                        onChange={(event) => {
                            setKeyword(event.target.value);
                            setPage(1);
                        }}
                    />
                    <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
                        <SelectTrigger className="md:w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">全部状态</SelectItem>
                            <SelectItem value="pending">排队中</SelectItem>
                            <SelectItem value="processing">生成中</SelectItem>
                            <SelectItem value="succeeded">已完成</SelectItem>
                            <SelectItem value="failed">失败</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={billingFilter} onValueChange={(value) => { setBillingFilter(value); setPage(1); }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">全部账务</SelectItem>
                            <SelectItem value="pending">待扣费</SelectItem>
                            <SelectItem value="deducted">已扣费</SelectItem>
                            <SelectItem value="refunded">已退款</SelectItem>
                            <SelectItem value="failed">扣费失败</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={modelFilter} onValueChange={(value) => { setModelFilter(value); setPage(1); }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">全部模型</SelectItem>
                            {models.map((model) => (
                                <SelectItem key={model.id} value={model.id}>{model.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} />
                    <Input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} />
                    <Select value={sortBy} onValueChange={(value) => { setSortBy(value as typeof sortBy); setPage(1); }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="createdAt">按创建时间</SelectItem>
                            <SelectItem value="updatedAt">按更新时间</SelectItem>
                            <SelectItem value="completedAt">按完成时间</SelectItem>
                            <SelectItem value="billingAmount">按算力</SelectItem>
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            {isError ? (
                <ErrorState title="加载历史失败" message="无法获取生成记录" onRetry={() => refetch()} />
            ) : (
                <>
                    <HistoryList
                        items={data?.items || []}
                        loading={isLoading}
                        showDelete
                        onDelete={(id) => deleteMutation.mutate(id)}
                        detailBasePath="/"
                    />
                    {data && data.total > pageSize && (
                        <div className="flex justify-center gap-2">
                            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                                上一页
                            </Button>
                            <span className="flex items-center px-2 text-sm">第 {page} 页</span>
                            <Button variant="outline" size="sm" disabled={page * pageSize >= data.total} onClick={() => setPage(page + 1)}>
                                下一页
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function activeTabValue(pathname: string) {
    if (pathname.endsWith("/studio")) return "/studio";
    if (pathname.endsWith("/history")) return "/history";
    return "/";
}
