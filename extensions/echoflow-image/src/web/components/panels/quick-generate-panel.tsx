import { cn } from "@buildingai/ui/lib/utils";
import type { ReactNode } from "react";

interface QuickGeneratePanelProps {
    children: ReactNode;
    result: ReactNode;
    history: ReactNode;
    isGenerating?: boolean;
}

export function QuickGeneratePanel({ children, result, history, isGenerating }: QuickGeneratePanelProps) {
    return (
        <div className="grid min-w-0 gap-2.5 xl:grid-cols-[minmax(340px,390px)_minmax(0,1fr)] xl:items-start">
            <section className="min-w-0 xl:sticky xl:top-2.5">{children}</section>
            <div className="grid min-w-0 content-start gap-2.5">
                <section className={cn("min-w-0 rounded-lg", isGenerating && "ring-1 ring-primary/25")}>
                    {result}
                </section>
                <section className="min-w-0">{history}</section>
            </div>
        </div>
    );
}
