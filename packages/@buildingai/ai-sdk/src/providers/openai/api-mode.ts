export type OpenAIApiMode = "chat" | "responses";

const CHAT_ONLY_PATTERNS: RegExp[] = [
    /^gpt-3\.5/,
    /^gpt-4$/,
    /^gpt-4-\d/,
    /^gpt-4-turbo/,
    /^gpt-4-vision/,
    /^gpt-4-32k/,
    /^gpt-4o(-mini)?-audio/,
    /^gpt-4o(-mini)?-search/,
    /^gpt-4o(-mini)?-realtime/,
    /^gpt-4o(-mini)?-transcribe/,
    /^o1-(mini|preview)/,
    /^o3-mini/,
];

const RESPONSES_PATTERNS: RegExp[] = [
    /^gpt-4\.1/,
    /^gpt-4o($|-\d)/,
    /^gpt-4o-mini($|-\d)/,
    /^gpt-5/,
    /^o1($|-\d)/,
    /^o3($|-\d|-pro)/,
    /^o4($|-)/,
    /^codex/,
    /^chatgpt-4o/,
];

function isOfficialOpenAIHost(baseURL?: string): boolean {
    if (!baseURL) return true;
    try {
        const h = new URL(baseURL).hostname;
        return h === "api.openai.com" || h.endsWith(".api.openai.com");
    } catch {
        return false;
    }
}

function normalizeModelId(modelId: string): string {
    let id = modelId.toLowerCase().trim();
    if (id.startsWith("ft:")) {
        id = id.replace(/^ft:/, "").split(":")[0] ?? id;
    }
    return id;
}

export function resolveOpenAIApiMode(
    modelId: string,
    baseURL?: string,
    override?: OpenAIApiMode,
): OpenAIApiMode {
    if (override) return override;

    if (!isOfficialOpenAIHost(baseURL)) return "chat";

    const id = normalizeModelId(modelId);

    if (CHAT_ONLY_PATTERNS.some((p) => p.test(id))) return "chat";
    if (RESPONSES_PATTERNS.some((p) => p.test(id))) return "responses";

    return "chat";
}
