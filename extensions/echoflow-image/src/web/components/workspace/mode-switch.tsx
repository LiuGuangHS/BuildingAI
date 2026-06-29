import { Button } from "@buildingai/ui/components/ui/button";
import { cn } from "@buildingai/ui/lib/utils";

export type WorkspaceMode = "quick" | "canvas";

interface ModeSwitchProps {
    value: WorkspaceMode;
    onChange: (value: WorkspaceMode) => void;
}

const modeItems: Array<{
    value: WorkspaceMode;
    title: string;
    description: string;
    mark: string;
}> = [
    {
        value: "quick",
        title: "生成",
        description: "快速出图",
        mark: "●",
    },
    {
        value: "canvas",
        title: "画布",
        description: "整理作品",
        mark: "□",
    },
];

export function WorkspaceModeSwitch({ value, onChange }: ModeSwitchProps) {
    return (
        <div className="inline-grid grid-cols-2 gap-1 rounded-lg border bg-muted/20 p-1" role="tablist" aria-label="EchoFlowAI 绘画模式">
            {modeItems.map((item) => {
                const active = value === item.value;
                return (
                    <Button
                        key={item.value}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        variant="ghost"
                        title={`${item.title}：${item.description}`}
                        onClick={() => onChange(item.value)}
                        className={cn(
                            "h-10 rounded-md px-2.5 text-xs text-muted-foreground sm:h-11",
                            active && "border border-primary/40 bg-primary/10 text-primary shadow-sm",
                        )}
                    >
                        <span aria-hidden="true" className="text-sm leading-none">{item.mark}</span>
                        <span className="flex flex-col items-start leading-none">
                            <span className="font-semibold">{item.title}</span>
                            <span className="mt-1 hidden text-[11px] font-normal opacity-75 sm:inline">{item.description}</span>
                        </span>
                    </Button>
                );
            })}
        </div>
    );
}
