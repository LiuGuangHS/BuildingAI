import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@buildingai/ui/components/ui/select";
import { cn } from "@buildingai/ui/lib/utils";

import type { ContractGenerationTask, ContractRiskFinding, ContractSection, ContractTemplate, ContractGenerationVersion } from "../../services/types";
import { buildDocumentSections, editableSectionsFromDocument, getCompletionSummary } from "./contract-document-model";
import { ContractPlateEditor } from "./ContractPlateEditor";

type RewriteMode = "stricter" | "favor_party_a" | "favor_party_b" | "concise" | "friendly" | "reduce_risk";

export function ContractDocumentWorkbench(props: {
    activeTask: ContractGenerationTask | null | undefined;
    template?: ContractTemplate;
    title: string;
    variables: Record<string, string>;
    sections: ContractSection[];
    documentRevision: number;
    selectedSectionIndex: number;
    draftEditable: boolean;
    rewriteMode: RewriteMode;
    rewritePreview: { content: string; reason: string } | null;
    rewritePending: boolean;
    versions: ContractGenerationVersion[];
    reviewPending: boolean;
    exportType: "contract" | "contract_with_report" | "risk_report";
    dirty: boolean;
    canSave: boolean;
    canReview: boolean;
    canExport: boolean;
    onSelectSection: (index: number) => void;
    onSectionsChange: (sections: ContractSection[]) => void;
    onRewriteModeChange: (value: RewriteMode) => void;
    onRewrite: () => void;
    onApplyRewrite: () => void;
    onCancelRewrite: () => void;
    onSave: () => void;
    onReview: () => void;
    onExport: () => void;
    onAcceptRisk: (index: number) => void;
    onIgnoreRisk: (index: number) => void;
    onRestoreVersion: (versionId: string) => void;
}) {
    const documentSections = buildDocumentSections({
        sections: props.sections,
        template: props.template,
        variables: props.variables,
        draft: !props.activeTask,
    });
    const editableSections = editableSectionsFromDocument(documentSections);
    const selectedDocumentIndex = Math.min(props.selectedSectionIndex, documentSections.length - 1);
    const selectedSection = documentSections[selectedDocumentIndex];
    const summary = getCompletionSummary(props.template, props.variables);
    const hasTask = Boolean(props.activeTask);
    const canEditDocument = hasTask || props.draftEditable;
    const riskCount = props.activeTask?.riskFindings?.length ?? 0;
    const highRiskCount = props.activeTask?.riskFindings?.filter((risk) => risk.level === "high").length ?? 0;
    const documentId = hasTask
        ? `${props.activeTask?.id ?? "task"}:${props.activeTask?.updatedAt ?? "draft"}:${props.documentRevision}`
        : `preview:${props.template?.id ?? "blank"}:${JSON.stringify(props.variables)}`;

    return (
        <section className="contract-document-workbench">
            <aside className="contract-outline-panel">
                <div className="contract-panel-title">
                    <span className="contract-panel-mark">01</span>
                    <div>
                        <h3>文档目录</h3>
                        <p>{hasTask ? "点击定位条款和风险。" : "生成前也可先编辑草稿。"}</p>
                    </div>
                </div>
                <div className="contract-outline-list">
                    {documentSections.map((section, index) => {
                        const relatedRisk = props.activeTask ? riskForSection(props.activeTask, section.title) : undefined;
                        return (
                            <Button
                                key={section.id ?? index}
                                className={cn("contract-outline-item", index === selectedDocumentIndex && "is-active")}
                                type="button"
                                variant="ghost"
                                onClick={() => props.onSelectSection(index)}
                            >
                                <span>{index + 1}</span>
                                <strong>{section.title}</strong>
                                <em>{relatedRisk ? riskLevelText(relatedRisk.level) : section.source === "task" ? "正文" : "草稿"}</em>
                            </Button>
                        );
                    })}
                </div>
                {!hasTask && (
                    <div className="contract-readiness-card">
                        <strong>信息完整度</strong>
                        <span>{summary.requiredTotal ? `${summary.completed}/${summary.requiredTotal} 个必填项` : "选择模板后显示必填项"}</span>
                        {!!summary.missing.length && <p>缺少：{summary.missing.slice(0, 4).map((item) => item.label).join("、")}</p>}
                    </div>
                )}
            </aside>

            <article className="contract-document-stage">
                <div className="contract-document-toolbar">
                    <div>
                        <Badge variant={hasTask ? "secondary" : "outline"}>{hasTask ? "可编辑正文" : "本地草稿"}</Badge>
                        {props.dirty && <Badge variant="outline" className="contract-badge-warning">{hasTask ? "未保存" : "已编辑"}</Badge>}
                    </div>
                    <div className="contract-document-actions">
                        <Button variant="outline" size="sm" onClick={props.onSave} disabled={!props.canSave}>
                            保存
                        </Button>
                        <Button variant="outline" size="sm" onClick={props.onReview} disabled={!props.canReview || props.reviewPending} loading={props.reviewPending}>
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
                            onSectionsChange={props.onSectionsChange}
                        />
                    </div>
                </div>
            </article>

            <aside className="contract-review-panel">
                <ReviewSummary
                    task={props.activeTask ?? null}
                    riskCount={riskCount}
                    highRiskCount={highRiskCount}
                    editableSections={editableSections}
                    exportType={props.exportType}
                    hasTask={hasTask}
                />
                <ClauseAssistant
                    disabled={!hasTask || !selectedSection}
                    rewriteMode={props.rewriteMode}
                    rewritePreview={props.rewritePreview}
                    rewritePending={props.rewritePending}
                    onRewriteModeChange={props.onRewriteModeChange}
                    onRewrite={props.onRewrite}
                    onApplyRewrite={props.onApplyRewrite}
                    onCancelRewrite={props.onCancelRewrite}
                />
                <RiskList task={props.activeTask ?? null} onAcceptRisk={props.onAcceptRisk} onIgnoreRisk={props.onIgnoreRisk} onSelectSection={props.onSelectSection} />
                <VersionList versions={props.versions} onRestoreVersion={props.onRestoreVersion} />
            </aside>
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

function ReviewSummary({ task, riskCount, highRiskCount, editableSections, exportType, hasTask }: { task: ContractGenerationTask | null; riskCount: number; highRiskCount: number; editableSections: ContractSection[]; exportType: string; hasTask: boolean }) {
    return (
        <section className="contract-review-summary">
            <div className="contract-panel-title">
                <span className="contract-panel-mark">03</span>
                <div>
                    <h3>审查概览</h3>
                    <p>{task ? "风险、版本和导出前检查。" : "生成后显示风险评分和导出检查。"}</p>
                </div>
            </div>
            <div className="contract-summary-grid">
                <div>
                    <strong>{task?.score?.overall ?? "--"}</strong>
                    <span>评分</span>
                </div>
                <div>
                    <strong>{editableSections.length || "--"}</strong>
                    <span>条款</span>
                </div>
                <div>
                    <strong>{riskCount || "--"}</strong>
                    <span>风险</span>
                </div>
            </div>
            <ul className="contract-export-checklist">
                <li data-state={editableSections.length > 0 ? "done" : "pending"}>{hasTask ? "正文条款" : "草稿条款"} {editableSections.length > 0 ? (hasTask ? "已生成" : "可编辑") : "待补充"}</li>
                <li data-state={highRiskCount === 0 ? "done" : "warn"}>{highRiskCount ? `${highRiskCount} 个高风险待处理` : "无未处理高风险"}</li>
                <li data-state="done">导出类型：{exportTypeText(exportType)}</li>
            </ul>
        </section>
    );
}

function ClauseAssistant(props: {
    disabled: boolean;
    rewriteMode: RewriteMode;
    rewritePreview: { content: string; reason: string } | null;
    rewritePending: boolean;
    onRewriteModeChange: (value: RewriteMode) => void;
    onRewrite: () => void;
    onApplyRewrite: () => void;
    onCancelRewrite: () => void;
}) {
    return (
        <section className="contract-clause-assistant">
            <div className="contract-panel-title">
                <span className="contract-panel-mark">02</span>
                <div>
                    <h3>条款优化</h3>
                    <p>按当前条款生成替换建议。</p>
                </div>
            </div>
            <Select value={props.rewriteMode} onValueChange={(value) => props.onRewriteModeChange(value as RewriteMode)}>
                <SelectTrigger className="w-full">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="reduce_risk">降低风险</SelectItem>
                    <SelectItem value="stricter">更严谨</SelectItem>
                    <SelectItem value="favor_party_a">偏甲方</SelectItem>
                    <SelectItem value="favor_party_b">偏乙方</SelectItem>
                    <SelectItem value="concise">更简洁</SelectItem>
                    <SelectItem value="friendly">更友好</SelectItem>
                </SelectContent>
            </Select>
            <Button className="contract-assistant-action" variant="outline" onClick={props.onRewrite} disabled={props.disabled || props.rewritePending} loading={props.rewritePending}>
                生成改写建议
            </Button>
            {props.rewritePreview && (
                <div className="contract-rewrite-preview">
                    <strong>改写原因</strong>
                    <p>{props.rewritePreview.reason}</p>
                    <strong>建议文本</strong>
                    <p>{props.rewritePreview.content}</p>
                    <div>
                        <Button size="sm" onClick={props.onApplyRewrite}>应用</Button>
                        <Button size="sm" variant="outline" onClick={props.onCancelRewrite}>放弃</Button>
                    </div>
                </div>
            )}
        </section>
    );
}

function RiskList({ task, onAcceptRisk, onIgnoreRisk, onSelectSection }: { task: ContractGenerationTask | null; onAcceptRisk: (index: number) => void; onIgnoreRisk: (index: number) => void; onSelectSection: (index: number) => void }) {
    const risks = task?.riskFindings ?? [];
    return (
        <section className="contract-review-section">
            <h3>风险建议</h3>
            <div className="contract-risk-list">
                {risks.slice(0, 5).map((risk, index) => {
                    const action = task?.riskActions?.[`${index}:${risk.sectionTitle}:${risk.issue}`]?.status;
                    const sectionIndex = task?.sections.findIndex((section) => section.title.includes(risk.sectionTitle) || risk.sectionTitle.includes(section.title)) ?? -1;
                    return (
                        <article key={`${risk.sectionTitle}-${index}`} className={`contract-risk-item ${risk.level}`}>
                            <div>
                                <span>{riskLevelText(risk.level)}</span>
                                <strong>{risk.sectionTitle}</strong>
                            </div>
                            <p>{risk.issue}</p>
                            <small>{risk.suggestion}</small>
                            {action && <em>{action === "accepted" ? "已采纳" : "已忽略"}</em>}
                            <div>
                                <Button size="sm" variant="ghost" onClick={() => sectionIndex >= 0 && onSelectSection(sectionIndex)} disabled={sectionIndex < 0}>定位</Button>
                                <Button size="sm" variant="outline" onClick={() => onAcceptRisk(index)} disabled={action === "accepted"}>采纳</Button>
                                <Button size="sm" variant="ghost" onClick={() => onIgnoreRisk(index)} disabled={action === "ignored"}>忽略</Button>
                            </div>
                        </article>
                    );
                })}
                {risks.length === 0 && <div className="contract-quiet-empty">暂无风险结果。生成或审查后会在这里显示建议。</div>}
            </div>
        </section>
    );
}

function VersionList({ versions, onRestoreVersion }: { versions: ContractGenerationVersion[]; onRestoreVersion: (versionId: string) => void }) {
    return (
        <section className="contract-review-section">
            <h3>版本记录</h3>
            <div className="contract-version-list">
                {versions.slice(0, 4).map((version) => (
                    <Button key={version.id} className="contract-version-item" type="button" variant="outline" onClick={() => onRestoreVersion(version.id)}>
                        <strong>v{version.versionNo} / {version.changeSummary || version.changeType}</strong>
                        <span>{new Date(version.createdAt).toLocaleString()}</span>
                    </Button>
                ))}
                {versions.length === 0 && <div className="contract-quiet-empty">保存或恢复后会形成版本记录。</div>}
            </div>
        </section>
    );
}

function riskForSection(task: ContractGenerationTask, sectionTitle: string) {
    return task.riskFindings.find((risk) => risk.sectionTitle.includes(sectionTitle) || sectionTitle.includes(risk.sectionTitle));
}

function riskLevelText(level: ContractRiskFinding["level"]) {
    return { high: "高风险", medium: "中风险", low: "低风险" }[level];
}

function exportTypeText(value: string) {
    return { contract: "正式合同", contract_with_report: "合同 + 风险报告", risk_report: "仅风险报告" }[value] ?? value;
}
