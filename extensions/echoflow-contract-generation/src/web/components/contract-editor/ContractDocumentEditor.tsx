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
    const sectionAnnotations = documentSections.map((section) => getSectionRiskAnnotation(section, props.activeTask?.riskFindings ?? []));
    const documentId = hasTask
        ? `${props.activeTask?.id ?? "task"}:${props.activeTask?.updatedAt ?? "draft"}:${props.documentRevision}`
        : `preview:${props.template?.id ?? "blank"}:${JSON.stringify(props.variables)}`;

    return (
        <section className="contract-document-app">
            <article className="contract-document-frame rounded-xl border bg-card/70">
                <ContractDocumentRibbon
                    hasTask={hasTask}
                    dirty={props.dirty}
                    riskCount={riskCount}
                    completedFacts={summary.completed}
                    requiredFacts={summary.requiredTotal}
                    canSave={props.canSave}
                    canReview={props.canReview}
                    canExport={props.canExport}
                    onSave={props.onSave}
                    onReview={props.onReview}
                    onExport={props.onExport}
                />
                <div className="contract-document-editor-shell">
                    <ContractDocumentOutline
                        task={props.activeTask}
                        sections={documentSections}
                        selectedIndex={selectedDocumentIndex}
                        onSelect={props.onSelectSection}
                    />
                    <div className="contract-document-canvas">
                        <div className="contract-document-paper" data-editable={canEditDocument ? "true" : "false"}>
                            <header className="contract-document-head">
                                <span>合同文件</span>
                                <h2>{props.title || props.template?.name || "合同草稿"}</h2>
                                <p>{hasTask ? "正文可直接编辑，保存后会生成版本记录。" : "可先调整草稿骨架，生成时会作为起草上下文。"}</p>
                            </header>
                            <div className="contract-document-body">
                                <ContractPlateEditor
                                    documentId={documentId}
                                    editable={canEditDocument}
                                    sections={documentSections}
                                    sourceSections={props.sections}
                                    selectedSectionIndex={selectedDocumentIndex}
                                    sectionAnnotations={sectionAnnotations}
                                    onSelectSection={props.onSelectSection}
                                    onSectionsChange={props.onSectionsChange}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </article>
        </section>
    );
}

function ContractDocumentRibbon(props: {
    hasTask: boolean;
    dirty: boolean;
    riskCount: number;
    completedFacts: number;
    requiredFacts: number;
    canSave: boolean;
    canReview: boolean;
    canExport: boolean;
    onSave: () => void;
    onReview: () => void;
    onExport: () => void;
}) {
    return (
        <div className="contract-document-ribbon" aria-label="合同文档工具栏">
            <div className="contract-ribbon-group">
                <strong>{props.hasTask ? "编辑正文" : "本地草稿"}</strong>
                <span>{props.dirty ? "未保存" : props.hasTask ? "已同步" : `${props.completedFacts}/${props.requiredFacts || 0} 个事实`}</span>
            </div>
            <div className="contract-ribbon-group" aria-label="视图状态">
                <span>A4 页面</span>
                <span>100%</span>
                <span>{props.riskCount ? `${props.riskCount} 条批注` : "无批注"}</span>
            </div>
            <div className="contract-ribbon-actions">
                <Button variant="outline" size="sm" onClick={props.onSave} disabled={!props.canSave}>保存</Button>
                <Button variant="outline" size="sm" onClick={props.onReview} disabled={!props.canReview}>AI 审查</Button>
                <Button size="sm" onClick={props.onExport} disabled={!props.canExport}>导出</Button>
            </div>
        </div>
    );
}

function ContractDocumentOutline(props: {
    task: ContractGenerationTask | null | undefined;
    sections: ReturnType<typeof buildDocumentSections>;
    selectedIndex: number;
    onSelect: (index: number) => void;
}) {
    return (
        <aside className="contract-document-outline" aria-label="合同大纲">
            <div className="contract-outline-head">
                <strong>大纲</strong>
                <span>{props.sections.length} 条</span>
            </div>
            <div className="contract-outline-list">
                {props.sections.map((section, index) => {
                    const relatedRisk = props.task ? riskForSection(props.task, section) : undefined;
                    return (
                        <Button
                            key={section.id ?? index}
                            className={cn("contract-outline-item h-auto w-full justify-start whitespace-normal px-2 py-2 text-left", index === props.selectedIndex && "is-active")}
                            type="button"
                            variant="ghost"
                            onClick={() => props.onSelect(index)}
                        >
                            <span className="mr-2 inline-grid size-5 shrink-0 place-items-center rounded border text-[11px]">{index + 1}</span>
                            <strong className="min-w-0 flex-1 truncate text-xs">{section.title}</strong>
                            <em className="shrink-0 text-[11px] not-italic text-muted-foreground">{relatedRisk ? riskLevelText(relatedRisk.level) : section.source === "task" ? "正文" : "草稿"}</em>
                        </Button>
                    );
                })}
            </div>
        </aside>
    );
}

function riskForSection(task: ContractGenerationTask, section: { id?: string; title: string }) {
    return task.riskFindings.find((risk) => (risk.sectionId && section.id && risk.sectionId === section.id) || risk.sectionTitle.includes(section.title) || section.title.includes(risk.sectionTitle));
}

function riskLevelText(level: ContractRiskFinding["level"]) {
    return { high: "高风险", medium: "中风险", low: "低风险" }[level];
}
