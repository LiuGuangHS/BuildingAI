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
                    <h3 className="text-sm font-semibold tracking-normal">AI 法务批注</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{risks.length ? "按合同条款定位问题和可执行建议。" : "审查后显示 AI 法务批注。"}</p>
                </div>
                <Badge variant={risks.length ? "secondary" : "outline"}>{risks.length ? `${risks.length} 项` : "待审查"}</Badge>
            </div>
            <div className="grid gap-2.5">
                {risks.slice(0, 5).map((risk, index) => {
                    const reasoning = deriveRiskReasoning(risk, index);
                    const action = props.task?.riskActions?.[reasoning.key]?.status;
                    const sectionIndex = props.task?.sections.findIndex((section) => (risk.sectionId && section.id && risk.sectionId === section.id) || section.title.includes(risk.sectionTitle) || risk.sectionTitle.includes(section.title)) ?? -1;
                    return (
                        <article key={reasoning.key} className={cn("contract-ai-comment-card grid gap-2 rounded-lg border border-l-4 bg-muted/35 p-2.5", riskBorderClass(risk.level))} data-level={risk.level}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <Badge variant={risk.level === "high" ? "destructive" : "secondary"}>{reasoning.severityLabel}</Badge>
                                {action && <em className="text-xs not-italic text-muted-foreground">{action === "accepted" ? "已采纳" : "已忽略"}</em>}
                            </div>
                            <dl className="grid gap-2">
                                <div><dt className="text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">批注问题</dt><dd className="mt-0.5 text-xs leading-relaxed">{reasoning.riskPoint}</dd></div>
                                {reasoning.quote && <div><dt className="text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">命中原文</dt><dd className="mt-0.5 rounded-md bg-background/70 px-2 py-1 text-xs leading-relaxed">{reasoning.quote}</dd></div>}
                                <div><dt className="text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">AI 建议</dt><dd className="mt-0.5 text-xs leading-relaxed">{reasoning.suggestion}</dd></div>
                                <div><dt className="text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">来源条款</dt><dd className="mt-0.5 text-xs leading-relaxed">{reasoning.sourceClause}</dd></div>
                            </dl>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <Button size="sm" variant="ghost" onClick={() => sectionIndex >= 0 && props.onSelectSection(sectionIndex)} disabled={sectionIndex < 0}>定位</Button>
                                <Button size="sm" variant="outline" onClick={() => props.onAcceptRisk(index)} disabled={!reasoning.canApplyRewrite || action === "accepted"}>采纳批注</Button>
                                <Button size="sm" variant="ghost" onClick={() => props.onIgnoreRisk(index)} disabled={action === "ignored"}>忽略</Button>
                            </div>
                        </article>
                    );
                })}
                {risks.length > 5 && <div className="rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">仅显示前 5 项，剩余 {risks.length - 5} 项可在导出报告或 Console 中查看。</div>}
                {risks.length === 0 && <div className="rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">暂无 AI 法务批注。生成或审查后，AI 会把问题、影响和建议拆开说明。</div>}
            </div>
        </section>
    );
}

function riskBorderClass(level: ContractGenerationTask["riskFindings"][number]["level"]) {
    if (level === "high") return "border-l-destructive";
    if (level === "medium") return "border-l-amber-500";
    return "border-l-primary";
}
