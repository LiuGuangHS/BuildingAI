import { Button } from "@buildingai/ui/components/ui/button";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@buildingai/ui/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@buildingai/ui/components/ui/tabs";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { cn } from "@buildingai/ui/lib/utils";
import { useId } from "react";

import type { ContractWorkbenchMode, ContractWorkbenchState } from "./contract-workbench-view-model";
import type { ContractTemplate, ContractTemplateField } from "../../services/types";

const EMPTY_SELECT_VALUE = "__empty__";

const stanceOptions = [
    { value: "neutral", label: "中立" },
    { value: "favor_party_a", label: "偏甲方" },
    { value: "favor_party_b", label: "偏乙方" },
    { value: "strict", label: "更严格" },
    { value: "friendly", label: "更友好" },
] as const;

const exportTypeOptions = [
    { value: "contract", label: "合同" },
    { value: "contract_with_report", label: "合同+报告" },
    { value: "risk_report", label: "仅报告" },
] as const;

export function ContractIntakeRail(props: {
    state: ContractWorkbenchState;
    mode: ContractWorkbenchMode;
    onModeChange: (mode: ContractWorkbenchMode) => void;
    selectedTemplate?: ContractTemplate;
    variables: Record<string, string>;
    errors: Record<string, string>;
    prompt: string;
    reviewFile: File | null;
    stance: string;
    exportType: "contract" | "contract_with_report" | "risk_report";
    isBusy: boolean;
    disabled?: boolean;
    primaryActionPending: boolean;
    primaryActionLabel: string;
    onPrimaryAction: () => void;
    onVariablesChange: (value: Record<string, string>) => void;
    onPromptChange: (value: string) => void;
    onReviewFileChange: (value: File | null) => void;
    onStanceChange: (value: string) => void;
    onExportTypeChange: (value: "contract" | "contract_with_report" | "risk_report") => void;
    onFillExample: () => void;
}) {
    const requiredFields = props.selectedTemplate?.fields.filter((field) => field.required) ?? [];
    const promptId = useId();
    const uploadId = useId();
    const inputDisabled = Boolean(props.disabled || props.isBusy || props.primaryActionPending);

    return (
        <section className="contract-panel contract-intake-panel grid gap-4">
            <Tabs value={props.mode} onValueChange={(value) => props.onModeChange(value as ContractWorkbenchMode)}>
                <TabsList className="w-full">
                    <TabsTrigger value="draft" disabled={inputDisabled}>起草</TabsTrigger>
                    <TabsTrigger value="review" disabled={inputDisabled}>审查</TabsTrigger>
                </TabsList>
            </Tabs>

            <div className="grid gap-2.5">
                <div className="contract-panel-head">
                    <h2>事实采集</h2>
                    <p>{props.state.billingNote}</p>
                </div>
                <div className="contract-fact-chips">
                    {props.state.recognizedFacts.slice(0, 5).map((fact) => (
                        <span key={fact.key} className="contract-fact-chip" data-state="known">
                            <strong>{fact.label}</strong>
                            <em>{fact.value}</em>
                        </span>
                    ))}
                    {props.state.missingFacts.slice(0, 4).map((fact) => (
                        <span key={fact.key} className="contract-fact-chip" data-state="missing">
                            <strong>{fact.label}</strong>
                            <em>待补充</em>
                        </span>
                    ))}
                    {props.state.recognizedFacts.length === 0 && props.state.missingFacts.length === 0 && <EmptyPanel>选择模板或上传文件后显示 AI 依据。</EmptyPanel>}
                </div>
            </div>

            {props.mode === "draft" && (
                <div className="contract-intake-fields grid gap-2 overflow-y-auto pr-1">
                    {requiredFields.map((field) => (
                        <TemplateCompactField
                            key={field.key}
                            field={field}
                            value={props.variables[field.key] ?? ""}
                            error={props.errors[field.key]}
                            disabled={inputDisabled}
                            onChange={(value) => props.onVariablesChange({ ...props.variables, [field.key]: value })}
                        />
                    ))}
                    <div className="grid gap-1.5">
                        <Label htmlFor={promptId} className="text-xs font-semibold text-muted-foreground">补充要求</Label>
                        <Textarea id={promptId} className="min-h-[104px] resize-y bg-muted/30" value={props.prompt} onChange={(event) => props.onPromptChange(event.target.value)} placeholder="付款节点、验收标准、违约责任..." disabled={inputDisabled} />
                    </div>
                </div>
            )}

            {props.mode === "review" && (
                <div className="grid gap-2 rounded-xl border border-dashed bg-muted/20 p-3">
                    <Label htmlFor={uploadId} className="text-sm font-semibold">上传合同</Label>
                    <Input id={uploadId} className="bg-background/70" type="file" accept=".doc,.docx,.pdf,.txt,.md,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(event) => props.onReviewFileChange(event.target.files?.[0] ?? null)} disabled={inputDisabled} />
                    <em className="text-xs not-italic text-muted-foreground">{props.reviewFile ? props.reviewFile.name : "Word / PDF / 文本"}</em>
                </div>
            )}

            <div className="grid grid-cols-2 gap-2">
                <Select value={props.stance} onValueChange={props.onStanceChange} disabled={inputDisabled}>
                    <SelectTrigger className="bg-background/70"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {stanceOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={props.exportType} onValueChange={(value) => props.onExportTypeChange(value as typeof props.exportType)} disabled={inputDisabled}>
                    <SelectTrigger className="bg-background/70"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {exportTypeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
                <Button className="min-h-9" variant="outline" type="button" onClick={props.onFillExample} disabled={inputDisabled}>示例</Button>
                <Button type="button" onClick={props.onPrimaryAction} disabled={inputDisabled || props.state.primaryAction.tone === "blocked"} loading={props.primaryActionPending}>
                    {props.primaryActionLabel}
                </Button>
            </div>
        </section>
    );
}

function EmptyPanel({ children }: { children: string }) {
    return <div className="rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">{children}</div>;
}

function TemplateCompactField(props: {
    field: ContractTemplateField;
    value: string;
    error?: string;
    disabled?: boolean;
    onChange: (value: string) => void;
}) {
    const id = useId();
    return (
        <div className="grid gap-1.5">
            <Label htmlFor={id} className="text-xs font-semibold text-muted-foreground">{props.field.label}{props.field.required ? " *" : ""}</Label>
            {props.field.type === "select" ? (
                <Select value={props.value || EMPTY_SELECT_VALUE} onValueChange={(value) => props.onChange(value === EMPTY_SELECT_VALUE ? "" : value)} disabled={props.disabled}>
                    <SelectTrigger id={id} className="bg-muted/30"><SelectValue placeholder="请选择" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value={EMPTY_SELECT_VALUE}>请选择</SelectItem>
                        {(props.field.options ?? []).map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                    </SelectContent>
                </Select>
            ) : (
                <Input id={id} className="bg-muted/30" type={props.field.type === "number" ? "number" : props.field.type === "date" ? "date" : "text"} value={props.value} onChange={(event) => props.onChange(event.target.value)} placeholder={props.field.placeholder} disabled={props.disabled} />
            )}
            {props.error && <em className={cn("text-xs not-italic text-destructive")}>{props.error}</em>}
        </div>
    );
}
