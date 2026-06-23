import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { cn } from "@buildingai/ui/lib/utils";

import type { ContractGenerationTask, ContractRiskFinding, ContractSection, ContractTemplate } from "../../services/types";
import { buildDocumentSections, getCompletionSummary, getSectionRiskAnnotation } from "./contract-document-model";
import { ContractPlateEditor } from "./ContractPlateEditor";

export function ContractDocumentWorkbench(props: {
    activeTask: ContractGenerationTask | null | undefined;
    template?: ContractTemplate;
    title: string;
    variables: Record<string, string>;
    sections: ContractSection[];
    documentRevision: number;
    selectedSectionIndex: number;
    draftEditable: boolean;
    dirty: boolean;
    canSave: boolean;
    canReview: boolean;
    canExport: boolean;
    onSelectSection: (index: number) => void;
    onSectionsChange: (sections: ContractSection[]) => void;
    onSave: () => void;
    onReview: () => void;
    onExport: () => void;
}) {
    const documentSections = buildDocumentSections({
        sections: props.sections,
        template: props.template,
        variables: props.variables,
        draft: !props.activeTask,
    });
    const selectedDocumentIndex = Math.min(props.selectedSectionIndex, documentSections.length - 1);
    const summary = getCompletionSummary(props.template, props.variables);
    const hasTask = Boolean(props.activeTask);
    const canEditDocument = hasTask || props.draftEditable;
    const riskCount = props.activeTask?.riskFindings?.length ?? 0;
    const sectionAnnotations = documentSections.map((section) => getSectionRiskAnnotation(section.title, props.activeTask?.riskFindings ?? []));
    const documentId = hasTask
        ? `${props.activeTask?.id ?? "task"}:${props.activeTask?.updatedAt ?? "draft"}:${props.documentRevision}`
        : `preview:${props.template?.id ?? "blank"}:${JSON.stringify(props.variables)}`;

    return (
        <section>
            <article className="rounded-lg border bg-card/95 p-2.5">
                <aside className="mb-2.5 grid gap-2">
                    <div className="flex items-start gap-2.5">
                        <span className="grid size-7 shrink-0 place-items-center rounded-md border border-primary/25 text-[11px] font-bold text-primary">01</span>
                        <div>
                            <h3 className="text-sm font-semibold tracking-normal">文档目录</h3>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hasTask ? "点击定位条款和风险。" : "生成前也可先编辑草稿。"}</p>
                        </div>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
                        {documentSections.map((section, index) => {
                            const relatedRisk = props.activeTask ? riskForSection(props.activeTask, section.title) : undefined;
                            return (
                                <Button
                                    key={section.id ?? index}
                                    className={cn("h-auto min-w-[min(180px,46vw)] flex-none justify-start whitespace-normal px-2.5 py-2 text-left", index === selectedDocumentIndex && "bg-primary/10 text-primary")}
                                    type="button"
                                    variant="ghost"
                                    onClick={() => props.onSelectSection(index)}
                                >
                                    <span className="mr-2 inline-grid size-6 shrink-0 place-items-center rounded-md border text-xs">{index + 1}</span>
                                    <strong className="min-w-0 truncate text-sm">{section.title}</strong>
                                    <em className="ml-auto shrink-0 text-xs not-italic text-muted-foreground">{relatedRisk ? riskLevelText(relatedRisk.level) : section.source === "task" ? "正文" : "草稿"}</em>
                                </Button>
                            );
                        })}
                    </div>
                    {!hasTask && (
                        <div className="grid gap-1 rounded-lg border border-dashed bg-muted/20 p-2.5 text-xs">
                            <strong className="text-sm">信息完整度</strong>
                            <span className="text-muted-foreground">{summary.requiredTotal ? `${summary.completed}/${summary.requiredTotal} 个必填项` : "选择模板后显示必填项"}</span>
                            {!!summary.missing.length && <p className="leading-relaxed text-muted-foreground">缺少：{summary.missing.slice(0, 4).map((item) => item.label).join("、")}</p>}
                        </div>
                    )}
                </aside>
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <Badge variant={hasTask ? "secondary" : "outline"}>{hasTask ? "可编辑正文" : "本地草稿"}</Badge>
                        {props.dirty && <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">{hasTask ? "未保存" : "已编辑"}</Badge>}
                    </div>
                    <div className="grid w-full grid-cols-3 gap-2 sm:w-auto sm:min-w-56">
                        <Button variant="outline" size="sm" onClick={props.onSave} disabled={!props.canSave}>
                            保存
                        </Button>
                        <Button variant="outline" size="sm" onClick={props.onReview} disabled={!props.canReview}>
                            审查
                        </Button>
                        <Button size="sm" onClick={props.onExport} disabled={!props.canExport}>
                            导出
                        </Button>
                    </div>
                </div>

                <div className="contract-document-paper" data-editable={canEditDocument ? "true" : "false"}>
                    <header className="contract-document-head">
                        <span>合同文件</span>
                        <h2>{props.title || props.template?.name || "合同草稿"}</h2>
                        <p>{hasTask ? "正文可直接编辑，保存后会生成版本记录。" : "可先调整草稿骨架，生成时会作为起草上下文。"}</p>
                        <DocumentProcess
                            hasTask={hasTask}
                            dirty={props.dirty}
                            riskCount={riskCount}
                            canExport={props.canExport}
                        />
                    </header>
                    <div className="contract-document-body">
                        <ContractPlateEditor
                            documentId={documentId}
                            editable={canEditDocument}
                            sections={documentSections}
                            sourceSections={props.sections}
                            selectedSectionIndex={selectedDocumentIndex}
                            sectionAnnotations={sectionAnnotations}
                            onSectionsChange={props.onSectionsChange}
                        />
                    </div>
                </div>
            </article>
        </section>
    );
}

function DocumentProcess({ hasTask, dirty, riskCount, canExport }: { hasTask: boolean; dirty: boolean; riskCount: number; canExport: boolean }) {
    const steps = [
        { label: "填写信息", active: !hasTask, complete: hasTask },
        { label: hasTask ? "编辑正文" : "编辑草稿", active: dirty || !hasTask, complete: hasTask && !dirty },
        { label: "风险审查", active: hasTask && riskCount === 0, complete: riskCount > 0 },
        { label: "导出归档", active: canExport && riskCount > 0, complete: false },
    ];
    return (
        <ol className="contract-document-process" aria-label="合同编辑流程">
            {steps.map((step, index) => (
                <li key={step.label} data-state={step.complete ? "complete" : step.active ? "active" : "pending"}>
                    <span>{index + 1}</span>
                    <strong>{step.label}</strong>
                </li>
            ))}
        </ol>
    );
}

function riskForSection(task: ContractGenerationTask, sectionTitle: string) {
    return task.riskFindings.find((risk) => risk.sectionTitle.includes(sectionTitle) || sectionTitle.includes(risk.sectionTitle));
}

function riskLevelText(level: ContractRiskFinding["level"]) {
    return { high: "高风险", medium: "中风险", low: "低风险" }[level];
}
