import type { VideoMediaItem, VideoModelOption } from "../services/types/generation";

export type VideoGenerationMode = "text" | "first-frame" | "reference" | "edit";

export interface VideoModeDefinition {
    id: VideoGenerationMode;
    label: string;
    shortLabel: string;
    description: string;
    abilityTypes: string[];
}

export interface VideoModeOption extends VideoModeDefinition {
    available: boolean;
    compatibleCount: number;
}

export interface MaterialSlot {
    id: string;
    type: VideoMediaItem["type"];
    label: string;
    required: boolean;
    accept: "image/*" | "video/*";
}

export const VIDEO_MODE_DEFINITIONS: VideoModeDefinition[] = [
    {
        id: "text",
        label: "文生视频",
        shortLabel: "文生",
        description: "只输入提示词，适合快速生成镜头。",
        abilityTypes: ["text_to_video"],
    },
    {
        id: "first-frame",
        label: "首帧图生视频",
        shortLabel: "首帧",
        description: "上传 1 张首帧图，控制开场画面。",
        abilityTypes: ["first_frame_i2v"],
    },
    {
        id: "reference",
        label: "多参考图",
        shortLabel: "参考图",
        description: "上传 1-4 张参考图，统一主体和风格。",
        abilityTypes: ["reference_to_video"],
    },
    {
        id: "edit",
        label: "视频编辑",
        shortLabel: "编辑",
        description: "上传视频素材，做动作、风格或画面改造。",
        abilityTypes: ["video_editing", "action_transfer"],
    },
];

export function getModeDefinition(mode: VideoGenerationMode) {
    return VIDEO_MODE_DEFINITIONS.find((item) => item.id === mode) ?? VIDEO_MODE_DEFINITIONS[0];
}

export function getModeOptions(models: VideoModelOption[]): VideoModeOption[] {
    return VIDEO_MODE_DEFINITIONS.map((definition) => {
        const compatibleCount = getCompatibleModels(definition.id, models).length;
        return {
            ...definition,
            available: compatibleCount > 0,
            compatibleCount,
        };
    });
}

export function getDefaultMode(models: VideoModelOption[], preferred?: VideoGenerationMode) {
    const options = getModeOptions(models);
    const preferredOption = preferred ? options.find((item) => item.id === preferred && item.available) : undefined;
    return preferredOption?.id ?? options.find((item) => item.available)?.id ?? "text";
}

export function getCompatibleModels(mode: VideoGenerationMode, models: VideoModelOption[]) {
    const definition = getModeDefinition(mode);
    return models.filter((model) => modelSupportsAnyAbility(model, definition.abilityTypes));
}

export function modelSupportsMode(model: VideoModelOption | undefined, mode: VideoGenerationMode) {
    if (!model) return false;
    return modelSupportsAnyAbility(model, getModeDefinition(mode).abilityTypes);
}

export function getMaterialSlots(mode: VideoGenerationMode, model?: VideoModelOption): MaterialSlot[] {
    const modelMediaTypes = new Set(model?.mediaTypes ?? model?.capabilities?.mediaTypes ?? []);
    const supportsReference = modelMediaTypes.has("reference_image")
        || modelSupportsAnyAbility(model, ["reference_to_video", "video_editing"]);

    if (mode === "first-frame") {
        return [
            {
                id: "first-frame",
                type: "first_frame",
                label: "首帧图",
                required: true,
                accept: "image/*",
            },
        ];
    }

    if (mode === "reference") {
        return Array.from({ length: 4 }).map((_, index) => ({
            id: `reference-${index + 1}`,
            type: "reference_image",
            label: `参考图 ${index + 1}`,
            required: index === 0,
            accept: "image/*" as const,
        }));
    }

    if (mode === "edit") {
        return [
            {
                id: "edit-video",
                type: "video",
                label: "视频素材",
                required: true,
                accept: "video/*",
            },
            ...(supportsReference
                ? [
                    {
                        id: "edit-reference-1",
                        type: "reference_image" as const,
                        label: "参考图",
                        required: false,
                        accept: "image/*" as const,
                    },
                ]
                : []),
        ];
    }

    return [];
}

export function inferModeFromMedia(media?: VideoMediaItem[], model?: VideoModelOption): VideoGenerationMode {
    if (media?.some((item) => item.type === "video")) return "edit";
    if (media?.some((item) => item.type === "first_frame")) return "first-frame";
    if (media?.some((item) => item.type === "reference_image")) return "reference";

    const abilityTypes = model?.capabilities?.abilityTypes ?? [];
    if (abilityTypes.includes("first_frame_i2v")) return "first-frame";
    if (abilityTypes.includes("reference_to_video")) return "reference";
    if (abilityTypes.includes("video_editing") || abilityTypes.includes("action_transfer")) return "edit";
    return "text";
}

export function sanitizeMediaForMode(mode: VideoGenerationMode, media: VideoMediaItem[]) {
    const filledMedia = media.filter((item) => item.url.trim() || item.fileId);

    if (mode === "text") return [];
    if (mode === "first-frame") {
        return filledMedia.filter((item) => item.type === "first_frame").slice(0, 1);
    }
    if (mode === "reference") {
        return filledMedia.filter((item) => item.type === "reference_image").slice(0, 4);
    }
    return [
        ...filledMedia.filter((item) => item.type === "video").slice(0, 1),
        ...filledMedia.filter((item) => item.type === "reference_image").slice(0, 1),
    ];
}

export function getMediaIssueForMode(mode: VideoGenerationMode, model: VideoModelOption | undefined, media: VideoMediaItem[]) {
    if (!model) return undefined;

    if (!modelSupportsMode(model, mode)) {
        return "当前模型不支持所选生成方式";
    }

    const firstFrames = media.filter((item) => item.type === "first_frame" && item.url.trim());
    const references = media.filter((item) => item.type === "reference_image" && item.url.trim());
    const videos = media.filter((item) => item.type === "video" && item.url.trim());

    if (media.some((item) => item.url.trim() && !item.fileId)) {
        return "历史外链素材需要重新上传后才能提交";
    }

    if (mode === "text") {
        return media.some((item) => item.url.trim()) ? "文生视频不需要媒体素材" : undefined;
    }
    if (mode === "first-frame") {
        if (firstFrames.length !== 1 || references.length > 0 || videos.length > 0) return "首帧图生视频需要且只需要 1 张首帧图";
    }
    if (mode === "reference") {
        if (references.length < 1) return "多参考图需要至少 1 张参考图";
        if (references.length > 4 || firstFrames.length > 0 || videos.length > 0) return "多参考图需要 1-4 张参考图";
    }
    if (mode === "edit") {
        if (videos.length !== 1 || firstFrames.length > 0) return "视频编辑需要 1 个视频素材";
        if (references.length > 1) return "视频编辑最多附加 1 张参考图";
    }

    return undefined;
}

function modelSupportsAnyAbility(model: VideoModelOption | undefined, abilityTypes: string[]) {
    if (!model) return false;
    const modelAbilityTypes = model.capabilities?.abilityTypes ?? [];
    return abilityTypes.some((type) => modelAbilityTypes.includes(type));
}
