import { Button } from "@buildingai/ui/components/ui/button";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@buildingai/ui/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@buildingai/ui/components/ui/tabs";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { cn } from "@buildingai/ui/lib/utils";

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
    const requiredFields = props.selectedTemplate?.fields.filter((field) => field.required).slice(0, 5) ?? [];

    return (
        <section className="grid gap-2.5 rounded-lg border bg-card/95 p-3 shadow-sm">
            <Tabs value={props.mode} onValueChange={(value) => props.onModeChange(value as ContractWorkbenchMode)}>
                <TabsList className="w-full">
                    <TabsTrigger value="draft">起草</TabsTrigger>
                    <TabsTrigger value="review">审查</TabsTrigger>
                </TabsList>
            </Tabs>

            <div className="grid gap-2">
                <div>
                    <h2 className="text-sm font-semibold tracking-normal">AI 依据</h2>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{props.state.billingNote}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {props.state.recognizedFacts.slice(0, 5).map((fact) => (
                        <span key={fact.key} className="grid max-w-full min-w-0 rounded-md border border-primary/20 bg-primary/5 px-2 py-1.5">
                            <strong className="block max-w-[220px] truncate text-[11px] font-semibold text-primary">{fact.label}</strong>
                            <em className="block max-w-[220px] truncate text-xs not-italic text-muted-foreground">{fact.value}</em>
                        </span>
                    ))}
                    {props.state.missingFacts.slice(0, 4).map((fact) => (
                        <span key={fact.key} className="grid max-w-full min-w-0 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5">
                            <strong className="block max-w-[220px] truncate text-[11px] font-semibold text-amber-700 dark:text-amber-300">{fact.label}</strong>
                            <em className="block max-w-[220px] truncate text-xs not-italic text-muted-foreground">待补充</em>
                        </span>
                    ))}
                    {props.state.recognizedFacts.length === 0 && props.state.missingFacts.length === 0 && <EmptyPanel>选择模板或上传文件后显示 AI 依据。</EmptyPanel>}
                </div>
            </div>

            {props.mode === "draft" && (
                <div className="grid gap-2">
                    {requiredFields.map((field) => (
                        <TemplateCompactField
                            key={field.key}
                            field={field}
                            value={props.variables[field.key] ?? ""}
                            error={props.errors[field.key]}
                            onChange={(value) => props.onVariablesChange({ ...props.variables, [field.key]: value })}
                        />
                    ))}
                    <Label className="grid gap-1.5">
                        <span className="text-xs font-semibold text-muted-foreground">补充要求</span>
                        <Textarea className="min-h-[104px] resize-y bg-muted/30" value={props.prompt} onChange={(event) => props.onPromptChange(event.target.value)} placeholder="付款节点、验收标准、违约责任..." />
                    </Label>
                </div>
            )}

            {props.mode === "review" && (
                <Label className="grid gap-2 rounded-lg border border-dashed border-primary/25 bg-primary/5 p-2.5">
                    <span className="text-sm font-semibold">上传合同</span>
                    <Input className="bg-muted/30" type="file" accept=".doc,.docx,.pdf,.txt,.md,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(event) => props.onReviewFileChange(event.target.files?.[0] ?? null)} />
                    <em className="text-xs not-italic text-muted-foreground">{props.reviewFile ? props.reviewFile.name : "Word / PDF / 文本"}</em>
                </Label>
            )}

            <div className="grid grid-cols-2 gap-2">
                <Select value={props.stance} onValueChange={props.onStanceChange}>
                    <SelectTrigger className="bg-muted/30"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {stanceOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={props.exportType} onValueChange={(value) => props.onExportTypeChange(value as typeof props.exportType)}>
                    <SelectTrigger className="bg-muted/30"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {exportTypeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
                <Button className="min-h-9" variant="outline" type="button" onClick={props.onFillExample}>示例</Button>
                <Button type="button" onClick={props.onPrimaryAction} disabled={props.isBusy || props.primaryActionPending || props.state.primaryAction.tone === "blocked"} loading={props.primaryActionPending}>
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
    onChange: (value: string) => void;
}) {
    return (
        <Label className="grid gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">{props.field.label}{props.field.required ? " *" : ""}</span>
            {props.field.type === "select" ? (
                <Select value={props.value || EMPTY_SELECT_VALUE} onValueChange={(value) => props.onChange(value === EMPTY_SELECT_VALUE ? "" : value)}>
                    <SelectTrigger className="bg-muted/30"><SelectValue placeholder="请选择" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value={EMPTY_SELECT_VALUE}>请选择</SelectItem>
                        {(props.field.options ?? []).map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                    </SelectContent>
                </Select>
            ) : (
                <Input className="bg-muted/30" type={props.field.type === "number" ? "number" : props.field.type === "date" ? "date" : "text"} value={props.value} onChange={(event) => props.onChange(event.target.value)} placeholder={props.field.placeholder} />
            )}
            {props.error && <em className={cn("text-xs not-italic text-destructive")}>{props.error}</em>}
        </Label>
    );
}
