import { Button } from "@buildingai/ui/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@buildingai/ui/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@buildingai/ui/components/ui/tabs";
import { useMemo } from "react";

import { ContractRewriteCompare } from "./ContractRewriteCompare";
import { ContractRiskReasoningPanel } from "./ContractRiskReasoningPanel";
import { deriveContractInspectorTabs } from "./contract-workbench-view-model";
import type { ContractGenerationTask, ContractGenerationVersion, ContractSection } from "../../services/types";

type RewriteMode = "stricter" | "favor_party_a" | "favor_party_b" | "concise" | "friendly" | "reduce_risk";

export function ContractInspector(props: {
    task: ContractGenerationTask | null | undefined;
    versions: ContractGenerationVersion[];
    selectedSection?: ContractSection;
    rewriteMode: RewriteMode;
    rewritePreview: { content: string; reason: string } | null;
    rewritePending: boolean;
    reviewPending: boolean;
    exportType: "contract" | "contract_with_report" | "risk_report";
    dirty: boolean;
    canReview: boolean;
    canExport: boolean;
    onRewriteModeChange: (value: RewriteMode) => void;
    onRewrite: () => void;
    onApplyRewrite: () => void;
    onCancelRewrite: () => void;
    onReview: () => void;
    onExport: () => void;
    onAcceptRisk: (index: number) => void;
    onIgnoreRisk: (index: number) => void;
    onSelectSection: (index: number) => void;
    onRestoreVersion: (versionId: string) => void;
}) {
    const tabs = useMemo(() => deriveContractInspectorTabs({
        riskCount: props.task?.riskFindings.length ?? 0,
        versionCount: props.versions.length,
        hasRewritePreview: Boolean(props.rewritePreview),
        canExport: props.canExport,
    }), [props.canExport, props.rewritePreview, props.task?.riskFindings.length, props.versions.length]);

    return (
        <section className="grid gap-2.5 rounded-lg border bg-card/95 p-3 shadow-sm">
            <Tabs defaultValue="risks" className="grid gap-2.5">
                <TabsList className="w-full">
                    {tabs.map((tab) => (
                        <TabsTrigger key={tab.key} value={tab.key}>
                            {tab.label}{tab.badge ? <span className="ml-1 max-w-[54px] truncate rounded-full bg-primary/10 px-1.5 py-px text-[10px]">{tab.badge}</span> : null}
                        </TabsTrigger>
                    ))}
                </TabsList>
                <TabsContent value="risks" className="grid gap-2.5">
                    <ContractRiskReasoningPanel task={props.task ?? null} onAcceptRisk={props.onAcceptRisk} onIgnoreRisk={props.onIgnoreRisk} onSelectSection={props.onSelectSection} />
                    <Button variant="outline" onClick={props.onReview} disabled={!props.canReview || props.reviewPending} loading={props.reviewPending}>重新审查</Button>
                </TabsContent>
                <TabsContent value="rewrite" className="grid gap-2.5">
                    <Select value={props.rewriteMode} onValueChange={(value) => props.onRewriteModeChange(value as RewriteMode)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="reduce_risk">降低风险</SelectItem>
                            <SelectItem value="stricter">更严谨</SelectItem>
                            <SelectItem value="favor_party_a">偏甲方</SelectItem>
                            <SelectItem value="favor_party_b">偏乙方</SelectItem>
                            <SelectItem value="concise">更简洁</SelectItem>
                            <SelectItem value="friendly">更友好</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={props.onRewrite} disabled={!props.task || !props.selectedSection || props.rewritePending} loading={props.rewritePending}>生成改写</Button>
                    <ContractRewriteCompare original={props.selectedSection?.content} preview={props.rewritePreview} onApply={props.onApplyRewrite} onCancel={props.onCancelRewrite} />
                </TabsContent>
                <TabsContent value="versions" className="grid gap-2.5">
                    <div className="grid gap-2">
                        {props.versions.slice(0, 6).map((version) => (
                            <Button key={version.id} variant="outline" className="grid h-auto w-full justify-stretch whitespace-normal p-2.5 text-left" type="button" onClick={() => props.onRestoreVersion(version.id)}>
                                <strong className="block min-w-0 truncate">v{version.versionNo} / {version.changeSummary || version.changeType}</strong>
                                <span className="block min-w-0 truncate text-xs text-muted-foreground">{new Date(version.createdAt).toLocaleString()}</span>
                            </Button>
                        ))}
                        {props.versions.length === 0 && <EmptyPanel>保存后会生成版本记录。</EmptyPanel>}
                    </div>
                </TabsContent>
                <TabsContent value="export" className="grid gap-2.5">
                    <div className="grid gap-2 rounded-lg border bg-muted/30 p-2.5">
                        <strong className="text-sm">{props.dirty ? "先保存修改" : props.canExport ? "可以导出" : "生成合同后可导出"}</strong>
                        <p className="text-xs text-muted-foreground">导出类型：{exportTypeText(props.exportType)}</p>
                        <Button onClick={props.onExport} disabled={!props.canExport}>导出结果</Button>
                    </div>
                </TabsContent>
            </Tabs>
        </section>
    );
}

function exportTypeText(value: string) {
    return { contract: "正式合同", contract_with_report: "合同 + 风险报告", risk_report: "仅风险报告" }[value] ?? value;
}

function EmptyPanel({ children }: { children: string }) {
    return <div className="rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">{children}</div>;
}
