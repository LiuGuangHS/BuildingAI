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
        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(560px,0.95fr)_minmax(520px,1fr)]">
            <div className="min-w-0">
                {children}
            </div>

            <div className="min-w-0 space-y-4 xl:sticky xl:top-6">
                <div className={cn("min-w-0", isGenerating && "rounded-md ring-1 ring-primary/15")}>
                    {result}
                </div>
                <div className="min-w-0">{history}</div>
            </div>
        </div>
    );
}
