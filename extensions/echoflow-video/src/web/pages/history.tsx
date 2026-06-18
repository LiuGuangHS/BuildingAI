import { useDocumentHead } from "@buildingai/hooks";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Input } from "@buildingai/ui/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@buildingai/ui/components/ui/select";
import { ArrowLeft, Film } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { ErrorState } from "../components/error-state";
import { HistoryList } from "../components/history-list";
import { useWebVideoListQuery } from "../services";
import type { VideoGenerationBillingStatus, VideoGenerationStatus } from "../services/types/generation";

export default function WebHistoryPage() {
    useDocumentHead({ title: "我的视频历史 - AI视频工作台" });
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

    return (
        <div className="min-h-screen space-y-6 p-4 md:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <Button variant="ghost" className="mb-2 w-fit" onClick={() => navigate("/")}>
                        <ArrowLeft className="size-4" />
                        返回工作台
                    </Button>
                    <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <Film className="size-5 text-primary" />
                        我的生成历史
                    </h1>
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
                            <SelectItem value="doubao-seedance-2-0-260128">Seedance 2.0</SelectItem>
                            <SelectItem value="doubao-seedance-1-5-pro-251215">Seedance 1.5 Pro</SelectItem>
                            <SelectItem value="kling-text2video">可灵文生视频</SelectItem>
                            <SelectItem value="kling-image2video">可灵图生视频</SelectItem>
                            <SelectItem value="kling-multi-image2video">可灵多图参考</SelectItem>
                            <SelectItem value="happyhorse-1.0-t2v">文生视频</SelectItem>
                            <SelectItem value="happyhorse-1.0-i2v">图生视频</SelectItem>
                            <SelectItem value="happyhorse-1.0-r2v">参考图生视频</SelectItem>
                            <SelectItem value="happyhorse-1.0-video-edit">视频编辑</SelectItem>
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
                        showDelete={false}
                        detailBasePath=".."
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
