import type {
    PromptOptimizationStyle,
    VideoGeneration,
    VideoGenerationBillingStatus,
    VideoGenerationStatus,
    VideoMediaItem,
} from "../services/types/generation";
import { type VideoGenerationMode, getModeDefinition, inferModeFromMedia } from "./video-mode";

export const statusLabel: Record<VideoGenerationStatus, string> = {
    pending: "排队中",
    processing: "生成中",
    succeeded: "已完成",
    failed: "失败",
};

export const billingLabel: Record<VideoGenerationBillingStatus, string> = {
    pending: "待扣费",
    deducted: "已扣费",
    refunded: "已退款",
    failed: "扣费失败",
};

export const promptStyleLabel: Record<PromptOptimizationStyle, string> = {
    cinematic: "电影感",
    commercial: "商业",
    realistic: "写实",
    anime: "动漫",
    minimal: "简洁",
};

export function getStatusLabel(status: VideoGenerationStatus | string) {
    return statusLabel[status as VideoGenerationStatus] ?? status;
}

export function getBillingLabel(status: VideoGenerationBillingStatus | string) {
    return billingLabel[status as VideoGenerationBillingStatus] ?? status;
}

export function getBillingTrustMessage(generation: Pick<VideoGeneration, "status" | "billingStatus" | "billingAmount">) {
    if (generation.billingAmount <= 0) return "本次未产生算力扣费";
    if (generation.status === "failed") {
        if (generation.billingStatus === "refunded") return "任务失败，已按账务事实退款";
        if (generation.billingStatus === "deducted") return "任务失败，已扣费，等待退款核对";
        if (generation.billingStatus === "failed") return "任务失败，扣费或退款异常，请联系管理员";
        return "任务失败，未完成扣费";
    }
    if (generation.billingStatus === "refunded") return "已退款";
    if (generation.billingStatus === "deducted") return "已扣费";
    if (generation.billingStatus === "failed") return "扣费异常，请联系管理员";
    return "提交后按配置预估扣费";
}

export function getMediaTypeLabel(type: VideoMediaItem["type"] | string) {
    if (type === "first_frame") return "首帧图";
    if (type === "reference_image") return "参考图";
    if (type === "video") return "视频";
    return type;
}

export function getModeLabel(mode: VideoGenerationMode) {
    return getModeDefinition(mode).label;
}

export function getGenerationModeLabel(generation: VideoGeneration) {
    const fallbackModel = {
        id: generation.modelConfigId || generation.model,
        name: generation.modelName || generation.model,
        model: generation.model,
        modelType: "",
        description: "",
        mediaTypes: generation.media.map((item) => item.type),
        capabilities: {
            abilityTypes: [],
            mediaTypes: generation.media.map((item) => item.type),
        },
    };
    return getModeLabel(inferModeFromMedia(generation.media, fallbackModel));
}

export function getPromptSourceLabel(source?: "ai" | "local") {
    if (source === "ai") return "AI 优化";
    if (source === "local") return "本地规则";
    return "未优化";
}

export function formatDateTime(iso?: string) {
    if (!iso) return "";
    return new Date(iso).toLocaleString("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function formatFullDateTime(iso?: string) {
    if (!iso) return "";
    return new Date(iso).toLocaleString("zh-CN");
}

export function formatDuration(startedAt?: string, completedAt?: string) {
    if (!startedAt || !completedAt) return null;
    const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
    if (ms < 0) return null;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds} 秒`;
    return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
}

export function formatFileSize(size?: number) {
    if (size == null) return "";
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
