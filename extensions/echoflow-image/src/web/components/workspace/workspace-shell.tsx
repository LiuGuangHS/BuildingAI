import { Button } from "@buildingai/ui/components/ui/button";
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
                <header className="grid min-w-0 items-center gap-2.5 rounded-lg border bg-card/95 p-2 shadow-sm sm:p-3 md:grid-cols-[minmax(13rem,1fr)_auto_auto]">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden="true">
                            画
                        </span>
                        <div className="min-w-0">
                            <h1 className="truncate text-lg font-semibold leading-none">EchoFlowAI 绘画</h1>
                            <p className="mt-1 hidden text-xs text-muted-foreground md:block">生成图片，整理到画布。</p>
                        </div>
                    </div>

                    <WorkspaceModeSwitch value={mode} onChange={onModeChange} />

                    <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1.5 md:ml-0">
                        {quickActions}
                        <Button variant="outline" size="sm" onClick={() => navigate("history")} className="rounded-md">
                            <span aria-hidden="true" className="text-sm leading-none">↗</span>
                            <span className="hidden sm:inline">历史</span>
                        </Button>
                    </div>
                </header>

                <div className={mode === "canvas" ? "min-h-0 flex-1" : "min-h-0"}>{children}</div>
            </div>
        </div>
    );
}
