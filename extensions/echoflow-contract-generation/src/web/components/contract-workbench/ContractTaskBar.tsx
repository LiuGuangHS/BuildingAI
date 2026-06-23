import { Badge } from "@buildingai/ui/components/ui/badge";
import { cn } from "@buildingai/ui/lib/utils";

import type { ContractWorkbenchState } from "./contract-workbench-view-model";

export function ContractTaskBar({ state }: { state: ContractWorkbenchState }) {
    return (
        <header className="grid items-center gap-3 rounded-lg border bg-card/95 p-3 shadow-sm lg:grid-cols-[minmax(0,1fr)_minmax(280px,auto)]">
            <div className="flex min-w-0 items-center gap-2.5 max-sm:items-start">
                <Badge variant="outline" className="shrink-0">{state.kicker}</Badge>
                <div className="min-w-0">
                    <h1 className="truncate text-[17px] font-semibold leading-tight tracking-normal max-sm:whitespace-normal">{state.title}</h1>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground max-sm:whitespace-normal">{state.subtitle}</p>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" aria-label="AI 合同信号">
                {state.aiSignals.map((signal) => (
                    <span key={signal.label} className={cn("min-w-0 rounded-md border bg-muted/35 px-2 py-1.5", signalToneClass(signal.tone))}>
                        <strong className="block truncate text-sm leading-none">{signal.value}</strong>
                        <em className="mt-1 block truncate text-[11px] not-italic text-muted-foreground">{signal.label}</em>
                    </span>
                ))}
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
