import { Badge } from "@buildingai/ui/components/ui/badge";
import { cn } from "@buildingai/ui/lib/utils";
import type { ReactNode } from "react";

import type { ContractWorkbenchState } from "./contract-workbench-view-model";

export function ContractTaskBar({ state, tools }: { state: ContractWorkbenchState; tools?: ReactNode }) {
    return (
        <header className="contract-taskbar rounded-xl border bg-card/95 px-3 py-2 shadow-sm">
            <div className="contract-taskbar-main">
                <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                        <h1 className="truncate text-[15px] font-semibold leading-tight tracking-normal max-sm:whitespace-normal">{state.title}</h1>
                        <Badge variant="outline" className="shrink-0">{state.kicker}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground max-sm:whitespace-normal">{state.subtitle}</p>
                </div>
                <div className="contract-taskbar-signals" aria-label="合同编辑信号">
                    {state.aiSignals.map((signal) => (
                        <span key={signal.label} className={cn("min-w-0 rounded-md border bg-card/70 px-2 py-1", signalToneClass(signal.tone))}>
                            <strong className="block truncate text-xs leading-none">{signal.value}</strong>
                            <em className="mt-0.5 block truncate text-[10px] not-italic text-muted-foreground">{signal.label}</em>
                        </span>
                    ))}
                </div>
                {tools ? <div className="contract-taskbar-tools">{tools}</div> : null}
            </div>
        </header>
    );
}

function signalToneClass(tone: ContractWorkbenchState["aiSignals"][number]["tone"]) {
    if (tone === "danger") return "border-destructive/25 text-destructive";
    if (tone === "warn") return "border-amber-500/30 text-amber-700 dark:text-amber-300";
    if (tone === "good") return "border-primary/25 text-primary";
    return "border-border text-foreground";
}
