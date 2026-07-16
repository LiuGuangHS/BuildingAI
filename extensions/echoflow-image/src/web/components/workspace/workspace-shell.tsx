import { Button } from "@buildingai/ui/components/ui/button";
import { type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { WorkspaceModeSwitch, type WorkspaceMode } from "./mode-switch";

interface WorkspaceShellProps {
    mode?: WorkspaceMode;
    onModeChange?: (mode: WorkspaceMode) => void;
    children: ReactNode;
    quickActions?: ReactNode;
}

export function WorkspaceShell({ mode, onModeChange, children, quickActions }: WorkspaceShellProps) {
    const navigate = useNavigate();

    return (
        <div className="ef-image-workbench min-w-0 bg-muted/20 p-2 sm:p-2.5">
            <div className="flex min-w-0 flex-col gap-2.5">
                <header className="ef-image-controlbar grid min-w-0 items-center gap-2.5 rounded-lg border bg-card/95 p-2 shadow-sm sm:p-3 md:grid-cols-[minmax(13rem,1fr)_auto_auto]">
                    <div className="min-w-0 px-1">
                        <div className="flex items-center gap-2">
                            <span aria-hidden="true" className="h-4 w-1 rounded-full bg-[color:var(--ef-image-cyanotype)]" />
                            <h1 className="truncate text-base font-semibold leading-none">新图片任务</h1>
                        </div>
                        <p className="mt-1 hidden text-xs text-muted-foreground md:block">像在灯箱上挑片：先生成，再下载、复用或整理到画布。</p>
                    </div>

                    {mode && onModeChange ? <WorkspaceModeSwitch value={mode} onChange={onModeChange} /> : null}

                    <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1.5 md:ml-0">
                        {quickActions}
                        <Button variant="outline" size="sm" onClick={() => navigate("history")} className="rounded-md">
                            <span aria-hidden="true" className="text-sm leading-none">↗</span>
                            <span className="hidden sm:inline">历史</span>
                        </Button>
                    </div>
                </header>

                <div className="min-h-0">{children}</div>
            </div>
        </div>
    );
}
