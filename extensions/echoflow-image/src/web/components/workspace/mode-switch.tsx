import { Tabs, TabsList, TabsTrigger } from "@buildingai/ui/components/ui/tabs";

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
        <Tabs value={value} onValueChange={(next) => onChange(next as WorkspaceMode)} className="min-w-0">
            <TabsList className="ef-image-contact-strip grid h-auto grid-cols-2 gap-1 rounded-lg border bg-muted/20 p-1" aria-label="图片工作区">
                {modeItems.map((item) => (
                    <TabsTrigger
                        key={item.value}
                        value={item.value}
                        title={`${item.title}：${item.description}`}
                        className="h-10 rounded-md px-2.5 text-xs text-muted-foreground data-[state=active]:border data-[state=active]:border-primary/40 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm sm:h-11"
                    >
                        <span aria-hidden="true" className="text-sm leading-none">{item.mark}</span>
                        <span className="flex flex-col items-start leading-none">
                            <span className="font-semibold">{item.title}</span>
                            <span className="mt-1 hidden text-[11px] font-normal opacity-75 sm:inline">{item.description}</span>
                        </span>
                    </TabsTrigger>
                ))}
            </TabsList>
        </Tabs>
    );
}
