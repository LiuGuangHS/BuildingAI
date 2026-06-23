import { useQuery } from "@tanstack/react-query";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@buildingai/ui/components/ui/table";

import { getTownContentPack } from "../../services/console/town";
import type { TownContentPackOverview } from "../../services/types";

export default function TownContentPackPage() {
    const overviewQuery = useQuery({
        queryKey: ["town-content-pack"],
        queryFn: getTownContentPack,
    });
    const overview = overviewQuery.data;

    return (
        <main className="town-console content-pack-page">
            <div className="console-section-header">
                <div>
                    <h1>内容包运营</h1>
                    <p className="console-muted">查看当前首发内容包、赛季、seed 策略、章节活动覆盖和存档分布。</p>
                </div>
                <Button variant="outline" onClick={() => overviewQuery.refetch()}>
                    刷新数据
                </Button>
            </div>

            {overviewQuery.isLoading ? <p className="text-sm text-muted-foreground">正在加载内容包...</p> : null}
            {overviewQuery.isError ? <p className="text-sm text-destructive">内容包加载失败，请稍后重试。</p> : null}
            {overview ? <ContentPackOverview overview={overview} /> : null}
        </main>
    );
}

function ContentPackOverview({ overview }: { overview: TownContentPackOverview }) {
    const { coverage, manifest } = overview;
    const currentRate = coverage.saveCount
        ? Math.round((coverage.currentPackSaveCount / coverage.saveCount) * 1000) / 10
        : 0;

    return (
        <div className="content-pack-layout">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="当前内容包" value={`${manifest.id}@${manifest.version}`} />
                <StatCard label="赛季" value={manifest.season.title} />
                <StatCard label="存档覆盖" value={`${currentRate}%`} />
                <StatCard label="进行中活动" value={coverage.activeFestivalCount} />
                <StatCard label="章节数" value={overview.catalogCounts.mainQuestChapters} />
                <StatCard label="活动候选" value={overview.catalogCounts.festivals} />
                <StatCard label="每日轮换" value={overview.catalogCounts.dailyTaskRotations} />
                <StatCard label="已完成活动" value={coverage.completedFestivalCount} />
            </section>

            <section className="content-pack-grid">
                <Card>
                    <CardHeader>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <CardTitle>发布信息</CardTitle>
                                <CardDescription>当前只读 manifest，正式运营开关后续进入配置层。</CardDescription>
                            </div>
                            <Badge variant={coverage.legacySaveCount ? "secondary" : "default"}>
                                {coverage.legacySaveCount ? "需关注旧快照" : "当前包一致"}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="grid gap-3 text-sm text-muted-foreground">
                        <InfoRow label="内容包 ID" value={manifest.id} />
                        <InfoRow label="版本" value={manifest.version} />
                        <InfoRow label="赛季 ID" value={manifest.season.id} />
                        <InfoRow label="开始日期" value={manifest.season.startsAt} />
                        <InfoRow label="seed 模式" value={manifest.seedStrategy.mode} />
                        <InfoRow label="执行时机" value={manifest.seedStrategy.shouldRun} />
                        <InfoRow label="幂等键" value={manifest.seedStrategy.idempotencyKey} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>内容范围</CardTitle>
                        <CardDescription>用于判断首发包是否具备完整经营闭环。</CardDescription>
                    </CardHeader>
                    <CardContent className="content-chip-list">
                        <ChipGroup label="建筑" items={manifest.includes.buildings} />
                        <ChipGroup label="区域" items={manifest.includes.areas} />
                        <ChipGroup label="居民" items={manifest.includes.characters} />
                        <ChipGroup label="行动" items={manifest.includes.actions} />
                        <ChipGroup label="选项" items={manifest.includes.choices} />
                        <ChipGroup label="成就" items={manifest.includes.achievements} />
                        <ChipGroup label="活动" items={manifest.includes.festivals} />
                        <ChipGroup label="章节" items={manifest.includes.mainQuestChapters.map((chapter) => `第 ${chapter} 章`)} />
                    </CardContent>
                </Card>
            </section>

            <section className="content-pack-grid">
                <DistributionCard title="存档内容包分布" rows={coverage.saveDistribution} emptyText="暂无存档" />
                <DistributionCard title="主线章节分布" rows={coverage.chapterDistribution} emptyText="暂无章节进度" />
            </section>

            <Card>
                <CardHeader>
                    <CardTitle>运营检查</CardTitle>
                    <CardDescription>只读告警用于发布前和内容包切换前排查。</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2">
                    {overview.warnings.length ? (
                        overview.warnings.map((warning) => (
                            <p key={warning} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                                {warning}
                            </p>
                        ))
                    ) : (
                        <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">未发现内容包覆盖异常。</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
    return (
        <Card size="sm">
            <CardContent>
                <p className="text-muted-foreground text-sm">{label}</p>
                <p className="text-2xl font-semibold">{value}</p>
            </CardContent>
        </Card>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-start justify-between gap-4 border-b pb-2 last:border-b-0 last:pb-0">
            <span>{label}</span>
            <span className="max-w-[70%] text-right font-medium text-foreground">{value}</span>
        </div>
    );
}

function ChipGroup({ items, label }: { items: Array<number | string>; label: string }) {
    return (
        <div className="grid gap-2">
            <p className="text-sm font-medium">{label}</p>
            <div className="flex flex-wrap gap-2">
                {items.map((item) => (
                    <Badge key={`${label}-${item}`} variant="outline">
                        {item}
                    </Badge>
                ))}
            </div>
        </div>
    );
}

function DistributionCard({ emptyText, rows, title }: { emptyText: string; rows: Record<string, number>; title: string }) {
    const entries = Object.entries(rows);

    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-hidden rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>项目</TableHead>
                                <TableHead>数量</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {entries.map(([key, value]) => (
                                <TableRow key={key}>
                                    <TableCell>{key}</TableCell>
                                    <TableCell>{value}</TableCell>
                                </TableRow>
                            ))}
                            {!entries.length ? (
                                <TableRow>
                                    <TableCell colSpan={2} className="text-muted-foreground">
                                        {emptyText}
                                    </TableCell>
                                </TableRow>
                            ) : null}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
