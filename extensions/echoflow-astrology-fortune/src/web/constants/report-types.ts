import { Briefcase, CalendarDays, Heart, MessageCircleQuestion, Star, UserRound } from "lucide-react";

import type { AstrologyReportStatus, AstrologyReportType } from "../services/types";

export type ReportPriceGroup = "daily" | "report" | "compatibility" | "decision";

export type ReportTypeOption = {
    value: AstrologyReportType;
    label: string;
    priceGroup: ReportPriceGroup;
};

export type ReportIntent = ReportTypeOption & {
    subtitle: string;
    icon: typeof Star;
    focusArea: string;
    currentState: string;
    question: string;
};

export const reportTypeOptions: ReportTypeOption[] = [
    { value: "daily", label: "今日运势", priceGroup: "daily" },
    { value: "profile", label: "出生资料画像", priceGroup: "report" },
    { value: "personality", label: "性格洞察", priceGroup: "report" },
    { value: "weekly", label: "周运报告", priceGroup: "report" },
    { value: "monthly", label: "月运报告", priceGroup: "report" },
    { value: "love", label: "感情分析", priceGroup: "report" },
    { value: "career", label: "事业财富", priceGroup: "report" },
    { value: "wealth", label: "财富分析", priceGroup: "report" },
    { value: "relationship", label: "关系分析", priceGroup: "report" },
    { value: "compatibility", label: "关系配对", priceGroup: "compatibility" },
    { value: "decision", label: "决策建议", priceGroup: "decision" },
];

export const reportIntents: ReportIntent[] = [
    { value: "daily", label: "今日运势", priceGroup: "daily", subtitle: "一键生成今日能量与行动建议", icon: CalendarDays, focusArea: "今日综合运势", currentState: "想知道今天适合推进什么", question: "今天我最应该把注意力放在哪里？" },
    { value: "personality", label: "性格画像", priceGroup: "report", subtitle: "长期性格、优势与情绪模式", icon: UserRound, focusArea: "性格与长期画像", currentState: "想更理解自己的行为模式", question: "请分析我的核心性格、优势、挑战和适合的发展方向。" },
    { value: "love", label: "感情分析", priceGroup: "report", subtitle: "关系状态、吸引模式与沟通建议", icon: Heart, focusArea: "感情与亲密关系", currentState: "想理解当前感情状态", question: "请分析我近期的感情能量、关系模式和适合采取的行动。" },
    { value: "career", label: "事业财富", priceGroup: "report", subtitle: "职业阶段、机会、财务倾向", icon: Briefcase, focusArea: "事业与财富", currentState: "想找到更清晰的事业节奏", question: "请分析我近期的事业财富趋势、机会和需要规避的风险。" },
    { value: "compatibility", label: "星座配对", priceGroup: "compatibility", subtitle: "双人吸引力、稳定性与雷区", icon: Star, focusArea: "关系配对", currentState: "想了解双方关系匹配度", question: "请分析我和对方的关系匹配度、吸引力、冲突来源和相处建议。" },
    { value: "decision", label: "决策占卜", priceGroup: "decision", subtitle: "针对具体问题给出理性行动建议", icon: MessageCircleQuestion, focusArea: "生活决策", currentState: "正在做一个重要选择", question: "我现在应该如何做这个决定？请给出倾向建议、理由、风险和未来7天观察点。" },
];

export const statusOptions: Array<{ value: AstrologyReportStatus; label: string }> = [
    { value: "pending", label: "等待中" },
    { value: "processing", label: "生成中" },
    { value: "success", label: "成功" },
    { value: "failed", label: "失败" },
];

export function reportLabel(type: AstrologyReportType) {
    return reportTypeOptions.find((item) => item.value === type)?.label || type;
}

export function statusLabel(status: AstrologyReportStatus) {
    return statusOptions.find((item) => item.value === status)?.label || status;
}

export function priceGroupLabel(group: ReportPriceGroup) {
    if (group === "daily") return "今日运势价格";
    if (group === "compatibility") return "关系分析价格";
    if (group === "decision") return "决策建议价格";
    return "问问/深度报告价格";
}
