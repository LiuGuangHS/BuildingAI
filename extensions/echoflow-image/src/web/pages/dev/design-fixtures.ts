import {
    ImageGenerationBillingStatus,
    ImageGenerationMode,
    ImageGenerationStatus,
    ImageResponseFormat,
    type GeneratedImageRecord,
    type ImageGeneration,
    type ImageModelOption,
} from "../../services/types/generation";

const now = "2026-07-10T09:00:00.000Z";

function makeArtwork({
    width,
    height,
    title,
    subtitle,
    colors,
    mark,
}: {
    width: number;
    height: number;
    title: string;
    subtitle: string;
    colors: [string, string, string];
    mark: string;
}) {
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
            <defs>
                <linearGradient id="wash" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stop-color="${colors[0]}"/>
                    <stop offset="0.55" stop-color="${colors[1]}"/>
                    <stop offset="1" stop-color="${colors[2]}"/>
                </linearGradient>
                <filter id="grain">
                    <feTurbulence baseFrequency="0.8" numOctaves="3" seed="7" type="fractalNoise"/>
                    <feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 .14 0"/>
                </filter>
            </defs>
            <rect width="100%" height="100%" fill="url(#wash)"/>
            <circle cx="${width * 0.72}" cy="${height * 0.28}" r="${Math.min(width, height) * 0.24}" fill="#fff" opacity=".18"/>
            <circle cx="${width * 0.25}" cy="${height * 0.76}" r="${Math.min(width, height) * 0.31}" fill="#061f2c" opacity=".18"/>
            <path d="M ${width * 0.08} ${height * 0.68} C ${width * 0.32} ${height * 0.38}, ${width * 0.5} ${height * 0.94}, ${width * 0.92} ${height * 0.52}" fill="none" stroke="#fff" stroke-width="${Math.max(3, width * 0.006)}" opacity=".38"/>
            <rect x="${width * 0.07}" y="${height * 0.08}" width="${width * 0.14}" height="${height * 0.055}" rx="${Math.min(width, height) * 0.01}" fill="#fff" opacity=".82"/>
            <text x="${width * 0.085}" y="${height * 0.119}" fill="#13212a" font-family="ui-monospace, monospace" font-size="${Math.max(12, width * 0.019)}" letter-spacing="2">${mark}</text>
            <text x="${width * 0.08}" y="${height * 0.79}" fill="#fff" font-family="Georgia, serif" font-size="${Math.max(28, width * 0.052)}" font-weight="700">${title}</text>
            <text x="${width * 0.082}" y="${height * 0.85}" fill="#fff" font-family="Arial, sans-serif" font-size="${Math.max(12, width * 0.018)}" letter-spacing="1.4" opacity=".82">${subtitle}</text>
            <rect width="100%" height="100%" filter="url(#grain)" opacity=".32"/>
        </svg>
    `;

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const designArtwork = {
    square: makeArtwork({
        width: 960,
        height: 960,
        title: "玻璃花园",
        subtitle: "BOTANICAL OBJECT STUDY",
        colors: ["#e6eee8", "#438c91", "#183c4a"],
        mark: "FRAME 01",
    }),
    landscape: makeArtwork({
        width: 1440,
        height: 820,
        title: "雨夜电台",
        subtitle: "NEON CITY / WIDE FRAME",
        colors: ["#16283b", "#166f78", "#d68a32"],
        mark: "FRAME 02",
    }),
    portrait: makeArtwork({
        width: 820,
        height: 1180,
        title: "静物档案",
        subtitle: "EDITORIAL STILL LIFE",
        colors: ["#eee7d9", "#b75f49", "#273947"],
        mark: "FRAME 03",
    }),
    poster: makeArtwork({
        width: 900,
        height: 1200,
        title: "柔光计划",
        subtitle: "SKINCARE CAMPAIGN",
        colors: ["#f1e8dd", "#d8a65f", "#6d7c7c"],
        mark: "FRAME 04",
    }),
} as const;

export const designCapabilityRows = [
    { key: "textToImage", label: "文生图", state: "ready", note: "当前 Web 主路径" },
    { key: "referenceImage", label: "参考图", state: "reserved", note: "二阶段能力，原型仅禁用展示" },
    { key: "multiReference", label: "多参考", state: "reserved", note: "二阶段能力，不能提交" },
    { key: "inpaint", label: "局部重绘", state: "reserved", note: "并入后续画布工作流" },
    { key: "seed", label: "Seed", state: "reserved", note: "后端 capability 未闭环前不开放" },
    { key: "background", label: "Background", state: "reserved", note: "仅作为能力占位" },
    { key: "inputFidelity", label: "Input fidelity", state: "reserved", note: "仅作为能力占位" },
    { key: "moderation", label: "Moderation", state: "reserved", note: "仅作为能力占位" },
] as const;

export const designModels = [
    {
        id: "public-image-model",
        name: "Echo Image Studio",
        model: "image-studio-v1",
        modelType: "text-to-image",
        capabilities: {
            textToImage: true,
            imageToImage: false,
            multiReference: false,
            mask: false,
            negativePrompt: false,
            seed: false,
            outputFormat: true,
            background: false,
            moderation: false,
            inputFidelity: false,
        },
        defaultParams: {
            size: "1024x1024",
            n: 2,
            quality: "standard",
            style: "natural",
            outputFormat: "png",
        },
        allowedParams: {
            sizes: ["1024x1024", "1536x1024", "1024x1536"],
            qualities: ["standard", "hd"],
            styles: ["natural", "vivid"],
            outputFormats: ["png", "webp"],
            maxImages: 4,
        },
    },
    {
        id: "public-fast-model",
        name: "Echo Image Fast",
        model: "image-fast-v1",
        modelType: "text-to-image",
        capabilities: {
            textToImage: true,
            imageToImage: false,
            multiReference: false,
            mask: false,
            negativePrompt: false,
            seed: false,
            outputFormat: true,
            background: false,
            moderation: false,
            inputFidelity: false,
        },
        defaultParams: {
            size: "1024x1024",
            n: 1,
            quality: "standard",
            style: "vivid",
            outputFormat: "webp",
        },
        allowedParams: {
            sizes: ["1024x1024", "1536x1024"],
            qualities: ["standard"],
            styles: ["natural", "vivid"],
            outputFormats: ["webp"],
            maxImages: 2,
        },
    },
] satisfies ImageModelOption[];

export interface DesignTemplate {
    id: string;
    title: string;
    category: string;
    prompt: string;
    accent: string;
    mark: string;
}

export const designTemplates: DesignTemplate[] = [
    {
        id: "template-editorial",
        title: "编辑静物",
        category: "品牌视觉",
        prompt: "高端护肤品编辑静物，磨砂玻璃、柔和工作室光、克制留白、精致材质与杂志排版",
        accent: "#0e6a73",
        mark: "ED",
    },
    {
        id: "template-cinematic",
        title: "电影夜景",
        category: "场景概念",
        prompt: "雨夜未来城市，潮湿路面倒映霓虹，远景薄雾，电影宽银幕构图，真实镜头质感",
        accent: "#d89b2b",
        mark: "CN",
    },
    {
        id: "template-botanical",
        title: "玻璃植物",
        category: "艺术实验",
        prompt: "透明玻璃植物标本，深青色背景，实验室档案摄影，微距细节，冷静克制的艺术指导",
        accent: "#667c67",
        mark: "BT",
    },
    {
        id: "template-poster",
        title: "展览海报",
        category: "平面设计",
        prompt: "当代艺术展览海报，非对称网格，大面积留白，几何色块，清晰标题区和印刷颗粒",
        accent: "#b75f49",
        mark: "PS",
    },
];

export interface DesignGeneratedImage extends GeneratedImageRecord {
    mockUrl: string;
}

export type DesignGeneration = Omit<ImageGeneration, "resultImages"> & {
    resultImages: DesignGeneratedImage[];
};

export const designGenerations = [
    {
        id: "design-success-square",
        mode: ImageGenerationMode.TEXT_TO_IMAGE,
        status: ImageGenerationStatus.SUCCEEDED,
        billingStatus: ImageGenerationBillingStatus.DEDUCTED,
        prompt: designTemplates[2].prompt,
        modelId: designModels[0].id,
        modelName: designModels[0].name,
        size: "1024x1024",
        n: 1,
        quality: "standard",
        style: "natural",
        responseFormat: ImageResponseFormat.URL,
        resultImages: [{ fileId: "design-square", mimeType: "image/svg+xml", size: 0, mockUrl: designArtwork.square, revisedPrompt: designTemplates[2].prompt }],
        billingAmount: 40,
        startedAt: now,
        completedAt: now,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: "design-success-landscape",
        mode: ImageGenerationMode.TEXT_TO_IMAGE,
        status: ImageGenerationStatus.SUCCEEDED,
        billingStatus: ImageGenerationBillingStatus.DEDUCTED,
        prompt: designTemplates[1].prompt,
        modelId: designModels[0].id,
        modelName: designModels[0].name,
        size: "1536x1024",
        n: 1,
        quality: "hd",
        style: "vivid",
        responseFormat: ImageResponseFormat.URL,
        resultImages: [{ fileId: "design-landscape", mimeType: "image/svg+xml", size: 0, mockUrl: designArtwork.landscape, revisedPrompt: designTemplates[1].prompt }],
        billingAmount: 80,
        startedAt: now,
        completedAt: now,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: "design-success-portrait",
        mode: ImageGenerationMode.TEXT_TO_IMAGE,
        status: ImageGenerationStatus.SUCCEEDED,
        billingStatus: ImageGenerationBillingStatus.DEDUCTED,
        prompt: designTemplates[0].prompt,
        modelId: designModels[0].id,
        modelName: designModels[0].name,
        size: "1024x1536",
        n: 1,
        quality: "standard",
        style: "natural",
        responseFormat: ImageResponseFormat.URL,
        resultImages: [{ fileId: "design-portrait", mimeType: "image/svg+xml", size: 0, mockUrl: designArtwork.portrait, revisedPrompt: designTemplates[0].prompt }],
        billingAmount: 60,
        startedAt: now,
        completedAt: now,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: "design-success-multiple",
        mode: ImageGenerationMode.TEXT_TO_IMAGE,
        status: ImageGenerationStatus.SUCCEEDED,
        billingStatus: ImageGenerationBillingStatus.DEDUCTED,
        prompt: designTemplates[0].prompt,
        modelId: designModels[0].id,
        modelName: designModels[0].name,
        size: "1024x1024",
        n: 4,
        quality: "standard",
        style: "natural",
        responseFormat: ImageResponseFormat.URL,
        resultImages: [
            { fileId: "design-multiple-square", mimeType: "image/svg+xml", size: 0, mockUrl: designArtwork.square, revisedPrompt: designTemplates[2].prompt },
            { fileId: "design-multiple-landscape", mimeType: "image/svg+xml", size: 0, mockUrl: designArtwork.landscape, revisedPrompt: designTemplates[1].prompt },
            { fileId: "design-multiple-portrait", mimeType: "image/svg+xml", size: 0, mockUrl: designArtwork.portrait, revisedPrompt: designTemplates[0].prompt },
            { fileId: "design-multiple-poster", mimeType: "image/svg+xml", size: 0, mockUrl: designArtwork.poster, revisedPrompt: designTemplates[3].prompt },
        ],
        billingAmount: 160,
        startedAt: now,
        completedAt: now,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: "design-pending",
        mode: ImageGenerationMode.TEXT_TO_IMAGE,
        status: ImageGenerationStatus.PENDING,
        billingStatus: ImageGenerationBillingStatus.DEDUCTED,
        prompt: designTemplates[1].prompt,
        modelId: designModels[0].id,
        modelName: designModels[0].name,
        size: "1536x1024",
        n: 1,
        responseFormat: ImageResponseFormat.URL,
        resultImages: [],
        billingAmount: 80,
        startedAt: now,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: "design-processing",
        mode: ImageGenerationMode.TEXT_TO_IMAGE,
        status: ImageGenerationStatus.PROCESSING,
        billingStatus: ImageGenerationBillingStatus.DEDUCTED,
        prompt: designTemplates[1].prompt,
        modelId: designModels[0].id,
        modelName: designModels[0].name,
        size: "1536x1024",
        n: 1,
        responseFormat: ImageResponseFormat.URL,
        resultImages: [],
        billingAmount: 80,
        startedAt: now,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: "design-failed",
        mode: ImageGenerationMode.TEXT_TO_IMAGE,
        status: ImageGenerationStatus.FAILED,
        billingStatus: ImageGenerationBillingStatus.REFUNDED,
        prompt: "一组用于沙箱失败态的占位提示词",
        modelId: designModels[0].id,
        modelName: designModels[0].name,
        size: "1024x1024",
        n: 1,
        responseFormat: ImageResponseFormat.URL,
        resultImages: [],
        errorMessage: "图片服务响应超时，请稍后重试；如已扣费将按账务结果处理。",
        billingAmount: 0,
        startedAt: now,
        completedAt: now,
        createdAt: now,
        updatedAt: now,
    },
] satisfies DesignGeneration[];

export type DesignScenario =
    | "empty"
    | "models-loading"
    | "models-error"
    | "estimate-loading"
    | "estimate-error"
    | "pending"
    | "processing"
    | "success-square"
    | "success-landscape"
    | "success-portrait"
    | "success-multiple"
    | "failed"
    | "reserved";

export const designScenarioOptions: Array<{ value: DesignScenario; label: string; group: string }> = [
    { value: "empty", label: "空工作区", group: "基础" },
    { value: "models-loading", label: "模型加载中", group: "模型" },
    { value: "models-error", label: "模型加载失败", group: "模型" },
    { value: "estimate-loading", label: "估价中", group: "费用" },
    { value: "estimate-error", label: "估价失败", group: "费用" },
    { value: "pending", label: "排队中", group: "任务" },
    { value: "processing", label: "生成中", group: "任务" },
    { value: "success-square", label: "成功 · 方图", group: "结果" },
    { value: "success-landscape", label: "成功 · 横图", group: "结果" },
    { value: "success-portrait", label: "成功 · 竖图", group: "结果" },
    { value: "success-multiple", label: "成功 · 多图", group: "结果" },
    { value: "failed", label: "生成失败", group: "任务" },
    { value: "reserved", label: "Reserved 边界", group: "能力" },
];

export function getDesignGeneration(scenario: DesignScenario): DesignGeneration | undefined {
    if (scenario === "pending") return designGenerations[4];
    if (scenario === "processing") return designGenerations[5];
    if (scenario === "success-square") return designGenerations[0];
    if (scenario === "success-landscape") return designGenerations[1];
    if (scenario === "success-portrait") return designGenerations[2];
    if (scenario === "success-multiple") return designGenerations[3];
    if (scenario === "failed") return designGenerations[6];
    return undefined;
}
