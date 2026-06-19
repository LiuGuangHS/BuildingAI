import { Button } from "@buildingai/ui/components/ui/button";
import { cn } from "@buildingai/ui/lib/utils";
import { RectangleEllipsis, Sparkles } from "lucide-react";

export type WorkspaceMode = "quick" | "canvas";

interface ModeSwitchProps {
    value: WorkspaceMode;
    onChange: (value: WorkspaceMode) => void;
}

const modeItems: Array<{
    value: WorkspaceMode;
    title: string;
    description: string;
    icon: typeof Sparkles;
}> = [
    {
        value: "quick",
        title: "生成模式",
        description: "提示词直接出图",
        icon: Sparkles,
    },
    {
        value: "canvas",
        title: "无限画布",
        description: "白板批注拼贴",
        icon: RectangleEllipsis,
    },
];

export function WorkspaceModeSwitch({ value, onChange }: ModeSwitchProps) {
    return (
        <div className="inline-flex items-stretch gap-1 rounded-lg border bg-background p-1">
            {modeItems.map((item) => {
                const Icon = item.icon;
                const active = value === item.value;
                return (
                    <Button
                        key={item.value}
                        type="button"
                        variant="ghost"
                        onClick={() => onChange(item.value)}
                        className={cn(
                            "h-auto min-w-[7.25rem] rounded-md px-3 py-2 text-left transition-colors",
                            active ? "bg-primary text-primary-foreground hover:bg-primary/95" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                    >
                        <Icon className="size-4 shrink-0" />
                        <span className="flex min-w-0 flex-col items-start">
                            <span className="text-sm font-medium leading-none">{item.title}</span>
                            <span className={cn("mt-1 text-[11px] leading-none", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                                {item.description}
                            </span>
                        </span>
                    </Button>
                );
            })}
        </div>
    );
}
