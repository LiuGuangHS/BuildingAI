import { Button } from "@buildingai/ui/components/ui/button";
import { Input } from "@buildingai/ui/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@buildingai/ui/components/ui/sheet";
import { cn } from "@buildingai/ui/lib/utils";

import type { ContractGenerationTask, ContractTemplate } from "../../services/types";

export function ContractTemplateDrawer(props: {
    templates: ContractTemplate[];
    tasks: ContractGenerationTask[];
    keyword: string;
    selectedTemplate?: ContractTemplate;
    onKeywordChange: (value: string) => void;
    onSelectTemplate: (template: ContractTemplate) => void;
    onSelectTask: (task: ContractGenerationTask) => void;
}) {
    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="outline" type="button">模板与历史</Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[min(420px,92vw)]">
                <SheetHeader>
                    <SheetTitle>模板与最近合同</SheetTitle>
                </SheetHeader>
                <div className="grid gap-2.5 px-3.5 pb-3.5">
                    <Input value={props.keyword} onChange={(event) => props.onKeywordChange(event.target.value)} placeholder="搜索模板、行业或类型" />
                    <div className="grid gap-2">
                        <h3 className="mt-2 text-sm font-semibold tracking-normal">模板</h3>
                        {props.templates.map((template) => (
                            <Button
                                key={template.id}
                                variant="ghost"
                                className={cn("grid h-auto justify-stretch whitespace-normal p-2.5 text-left", props.selectedTemplate?.id === template.id && "bg-primary/10 text-primary")}
                                type="button"
                                onClick={() => props.onSelectTemplate(template)}
                            >
                                <strong className="block min-w-0 truncate">{template.name}</strong>
                                <span className="block min-w-0 truncate text-xs text-muted-foreground">{template.industry} / {template.contractType}</span>
                            </Button>
                        ))}
                    </div>
                    <div className="grid gap-2">
                        <h3 className="mt-2 text-sm font-semibold tracking-normal">最近合同</h3>
                        {props.tasks.map((task) => (
                            <Button key={task.id} variant="ghost" className="grid h-auto justify-stretch whitespace-normal p-2.5 text-left" type="button" onClick={() => props.onSelectTask(task)}>
                                <strong className="block min-w-0 truncate">{task.title}</strong>
                                <span className="block min-w-0 truncate text-xs text-muted-foreground">{new Date(task.createdAt).toLocaleDateString()}</span>
                            </Button>
                        ))}
                        {props.tasks.length === 0 && <div className="rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">暂无最近合同。</div>}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
