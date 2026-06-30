import { useDocumentHead } from "@buildingai/hooks";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent } from "@buildingai/ui/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@buildingai/ui/components/ui/tabs";
import { ArrowLeft, Clock, History, SquareStack } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

export default function WebStudioReservedPage() {
    useDocumentHead({ title: "短视频制作 - 视频生成" });
    const navigate = useNavigate();
    const location = useLocation();
    const tabs = [
        { label: "生成", path: "/" },
        { label: "历史", path: "/history" },
        { label: "短视频", path: "/studio" },
    ] as const;

    return (
        <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4 p-3 md:p-4">
            <div className="flex flex-col gap-3 rounded-xl border bg-background/85 p-3 shadow-sm md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 space-y-1">
                    <h1 className="truncate text-lg font-semibold tracking-tight md:text-xl">短视频制作</h1>
                    <p className="truncate text-sm text-muted-foreground">预留脚本、分镜、素材和合成任务工作区。</p>
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
                <CardContent className="flex items-center gap-3 p-4">
                    <Clock className="size-5 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                        该入口已预留，当前版本优先完成单任务视频生成、历史复用和异步结果查看。
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}

function activeTabValue(pathname: string) {
    if (pathname.endsWith("/studio")) return "/studio";
    if (pathname.endsWith("/history")) return "/history";
    return "/";
}
