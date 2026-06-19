import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { cn } from "@buildingai/ui/lib/utils";
import { History, WandSparkles } from "lucide-react";
import { type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { WorkspaceModeSwitch, type WorkspaceMode } from "./mode-switch";

interface WorkspaceShellProps {
    mode: WorkspaceMode;
    onModeChange: (mode: WorkspaceMode) => void;
    children: ReactNode;
    quickActions?: ReactNode;
}

export function WorkspaceShell({ mode, onModeChange, children, quickActions }: WorkspaceShellProps) {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background px-4 py-4 md:px-6 md:py-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-4">
                <header className="rounded-xl border bg-card/95 px-4 py-4 shadow-sm backdrop-blur md:px-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                            <div className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                                <WandSparkles className="size-5" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="text-[1.6rem] font-semibold leading-none">AI 绘画</h1>
                                    <Badge variant="secondary">主站生图模型</Badge>
                                    <Badge variant="outline">OpenAI-compatible</Badge>
                                </div>
                                <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                                    生成模式适合快速出图，无限画布适合拖拽、组合和迭代。两种模式共享同一套模型、计费和历史。
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 xl:items-end">
                            <WorkspaceModeSwitch value={mode} onChange={onModeChange} />
                            <div className="flex flex-wrap items-center gap-2">
                                {quickActions}
                                <Button variant="outline" size="sm" onClick={() => navigate("history")} className="rounded-md">
                                    <History className="size-4" />
                                    全部历史
                                </Button>
                            </div>
                        </div>
                    </div>
                </header>

                <div className={cn("min-h-0", mode === "canvas" ? "flex-1" : "")}>{children}</div>
            </div>
        </div>
    );
}
