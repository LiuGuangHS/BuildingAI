import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const serviceSource = readFileSync(
    new URL("../src/api/modules/astrology-fortune/services/astrology-fortune.service.ts", import.meta.url),
    "utf8",
);

function methodBody(name) {
    const start = serviceSource.search(new RegExp(`\\n    (private async |async |private )${name}\\(`));
    assert.notEqual(start, -1, `${name} should exist`);
    const nextPrivateAsync = serviceSource.indexOf("\n    private async ", start + 1);
    const nextAsync = serviceSource.indexOf("\n    async ", start + 1);
    const nextPrivate = serviceSource.indexOf("\n    private ", start + 1);
    const next = [nextPrivateAsync, nextAsync, nextPrivate].filter((index) => index > start).sort((a, b) => a - b)[0];
    return serviceSource.slice(start, next === undefined ? undefined : next);
}

describe("astrology prompt boundary", () => {
    it("passes follow-up source report context into the queued AI prompt payload", () => {
        const generateBody = methodBody("generateReport");
        const promptBody = methodBody("buildPrompt");

        assert.match(generateBody, /const sourceReport = normalizedDto\.sourceReportId/);
        assert.match(generateBody, /sourceReportContext/);
        assert.match(generateBody, /const promptPayload: AstrologyReportPromptPayload/);
        assert.match(generateBody, /requestPayload: promptPayload as unknown as Record<string, unknown>/);
        assert.match(promptBody, /追问来源报告/);
        assert.match(promptBody, /dto\.sourceReportContext/);
        assert.match(promptBody, /summary/);
    });

    it("keeps the AI prompt business-shaped and JSON-only", () => {
        const promptBody = methodBody("buildPrompt");

        for (const phrase of [
            "你是 EchoFlowAI 的星盘与生活决策分析师",
            "请避免绝对化断言",
            "不得使用“必然、注定、保证、一定会、绝对会、必赚、稳赚”等确定性承诺",
            "只输出一个 JSON 对象",
            "报告类型:",
            "关注方向:",
            "当前状态:",
            "用户问题:",
            "目标对象/关系对象",
            "evidence 是 2-5 条判断依据",
            "confidence 只能是 low、medium、high",
            "追问来源报告里 high 置信度的依据可以作为延续判断",
            "low 置信度只能作为待验证线索",
            "followUps 是 2-4 条适合继续追问的问题",
            "actions 是 3-5 条可执行建议",
            "warnings 是 2-4 条风险提醒",
            "item 或 reason 必须能回到 evidence 的 source 或 insight",
            "title 或 detail 必须能回到 evidence 的 source 或 insight",
        ]) {
            assert.match(promptBody, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        }
    });

    it("passes question quality into the queued payload and model prompt", () => {
        const generateBody = methodBody("generateReport");
        const promptBody = methodBody("buildPrompt");

        assert.match(generateBody, /const questionQuality = buildAstrologyQuestionQualityContext\(normalizedDto\)/);
        assert.match(generateBody, /questionQuality,/);
        assert.match(generateBody, /sourceReportContext: this\.buildSourceReportPromptContext\(sourceReport\)/);
        assert.match(generateBody, /buildAstrologyReportGenerationContext\(normalizedDto, questionQuality\)/);
        assert.match(promptBody, /summarizeAstrologyQuestionQuality/);
        assert.match(promptBody, /如果问题质量是 weak/);
        assert.doesNotMatch(promptBody, /secret|provider|apiKey/i);
    });

    it("feeds sanitized source report feedback into follow-up prompt context", () => {
        const helperBody = methodBody("buildSourceReportPromptContext");
        const promptBody = methodBody("buildPrompt");
        const sourceContextType = serviceSource.slice(
            serviceSource.indexOf("type AstrologySourceReportPromptContext"),
            serviceSource.indexOf("type PublicAiModelInfo"),
        );

        assert.match(sourceContextType, /evidence/);
        assert.match(sourceContextType, /confidence/);
        assert.match(helperBody, /providerMetadata\?\.feedback/);
        assert.match(helperBody, /result\?\.evidence/);
        assert.match(helperBody, /source/);
        assert.match(helperBody, /insight/);
        assert.match(helperBody, /confidence/);
        assert.match(helperBody, /rating/);
        assert.match(helperBody, /note/);
        assert.match(promptBody, /追问来源报告/);
        assert.doesNotMatch(helperBody, /rawResponse|secretId|apiKey|providerConfig/i);
    });

    it("repairs malformed AI report JSON once without relaxing the strict result contract", () => {
        const processBody = methodBody("processReport");
        const retrySource = readFileSync(
            new URL("../src/api/modules/astrology-fortune/services/astrology-report-ai-retry.ts", import.meta.url),
            "utf8",
        );

        assert.match(serviceSource, /generateAstrologyReportAiResultWithRepair/);
        assert.match(processBody, /basePrompt: this\.buildPrompt\(dto, profile\)/);
        assert.match(processBody, /generate: \(prompt\) =>/);
        assert.match(processBody, /this\.publicAiModelService\.generateText\(model\.id/);
        assert.match(processBody, /parse: parseAstrologyReportAiResult/);
        assert.match(processBody, /normalizeAstrologyReportAiResult\(aiGeneration\.result\)/);
        assert.match(processBody, /\.\.\.aiGeneration\.metadata/);
        assert.match(retrySource, /必然、注定、保证、一定会、绝对会、必赚、稳赚/);
    });
});
