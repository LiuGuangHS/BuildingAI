import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { cn } from "@buildingai/ui/lib/utils";

import type { ContractGenerationTask } from "../../services/types";
import { deriveRiskReasoning } from "./contract-inspector-model";

export function ContractRiskReasoningPanel(props: {
    task: ContractGenerationTask | null;
    onAcceptRisk: (index: number) => void;
    onIgnoreRisk: (index: number) => void;
    onSelectSection: (index: number) => void;
}) {
    const risks = props.task?.riskFindings ?? [];
    return (
        <section className="grid gap-3">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-sm font-semibold tracking-normal">AI 风险推理</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{risks.length ? "按风险影响和可执行建议排序。" : "审查后显示结构化推理。"}</p>
                </div>
                <Badge variant={risks.length ? "secondary" : "outline"}>{risks.length ? `${risks.length} 项` : "待审查"}</Badge>
            </div>
            <div className="grid gap-2.5">
                {risks.slice(0, 5).map((risk, index) => {
                    const reasoning = deriveRiskReasoning(risk, index);
                    const action = props.task?.riskActions?.[reasoning.key]?.status;
                    const sectionIndex = props.task?.sections.findIndex((section) => section.title.includes(risk.sectionTitle) || risk.sectionTitle.includes(section.title)) ?? -1;
                    return (
                        <article key={reasoning.key} className={cn("grid gap-2 rounded-lg border border-l-4 bg-muted/35 p-2.5", riskBorderClass(risk.level))}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <Badge variant={risk.level === "high" ? "destructive" : "secondary"}>{reasoning.severityLabel}</Badge>
                                <span className="text-xs font-medium text-muted-foreground">置信度 {reasoning.confidence}%</span>
                            </div>
                            <dl className="grid gap-2">
                                <div><dt className="text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">风险点</dt><dd className="mt-0.5 text-xs leading-relaxed">{reasoning.riskPoint}</dd></div>
                                <div><dt className="text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">影响</dt><dd className="mt-0.5 text-xs leading-relaxed">{reasoning.impact}</dd></div>
                                <div><dt className="text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">AI 建议</dt><dd className="mt-0.5 text-xs leading-relaxed">{reasoning.suggestion}</dd></div>
                                <div><dt className="text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">来源条款</dt><dd className="mt-0.5 text-xs leading-relaxed">{reasoning.sourceClause}</dd></div>
                            </dl>
                            {action && <em className="text-xs not-italic text-muted-foreground">{action === "accepted" ? "已采纳" : "已忽略"}</em>}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <Button size="sm" variant="ghost" onClick={() => sectionIndex >= 0 && props.onSelectSection(sectionIndex)} disabled={sectionIndex < 0}>定位</Button>
                                <Button size="sm" variant="outline" onClick={() => props.onAcceptRisk(index)} disabled={!reasoning.canApplyRewrite || action === "accepted"}>应用建议</Button>
                                <Button size="sm" variant="ghost" onClick={() => props.onIgnoreRisk(index)} disabled={action === "ignored"}>忽略</Button>
                            </div>
                        </article>
                    );
                })}
                {risks.length === 0 && <div className="rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">暂无风险结果。生成或审查后，AI 会把问题、影响和建议拆开说明。</div>}
            </div>
        </section>
    );
}

function riskBorderClass(level: ContractGenerationTask["riskFindings"][number]["level"]) {
    if (level === "high") return "border-l-destructive";
    if (level === "medium") return "border-l-amber-500";
    return "border-l-primary";
}
