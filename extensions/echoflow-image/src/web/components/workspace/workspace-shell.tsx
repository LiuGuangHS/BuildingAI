import { Button } from "@buildingai/ui/components/ui/button";
import { Database, History, Sparkles, WandSparkles } from "lucide-react";
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
        <div className="min-w-0 bg-muted/20 p-2 sm:p-2.5">
            <div className="flex min-w-0 flex-col gap-2.5">
                <header className="grid min-w-0 items-center gap-2.5 rounded-lg border bg-card/95 p-2 shadow-sm sm:p-3 md:grid-cols-[minmax(13rem,auto)_auto_minmax(0,1fr)_auto]">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden="true">
                            <WandSparkles className="size-4" />
                        </span>
                        <div className="min-w-0">
                            <h1 className="truncate text-lg font-semibold leading-none">EchoFlowAI 绘画</h1>
                            <p className="mt-1 hidden text-xs text-muted-foreground md:block">按当前账号可用模型生成，作品可继续整理到画布。</p>
                        </div>
                    </div>

                    <WorkspaceModeSwitch value={mode} onChange={onModeChange} />

                    <div className="hidden min-w-0 flex-wrap items-center gap-1.5 md:flex" aria-label="模型与能力">
                        <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border bg-background px-2.5 py-2 text-xs text-muted-foreground">
                            <Database className="size-3.5" />
                            主站生图模型
                        </span>
                        <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border bg-background px-2.5 py-2 text-xs text-muted-foreground">
                            <Sparkles className="size-3.5" />
                            OpenAI-compatible
                        </span>
                    </div>

                    <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1.5 md:ml-0">
                        {quickActions}
                        <Button variant="outline" size="sm" onClick={() => navigate("history")} className="rounded-md">
                            <History className="size-4" />
                            <span className="hidden sm:inline">历史</span>
                        </Button>
                    </div>
                </header>

                <div className={mode === "canvas" ? "min-h-0 flex-1" : "min-h-0"}>{children}</div>
            </div>
        </div>
    );
}
