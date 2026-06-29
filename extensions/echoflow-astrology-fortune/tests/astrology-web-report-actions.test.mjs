import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const pageSource = readFileSync(
    new URL("../src/web/pages/index.tsx", import.meta.url),
    "utf8",
);

function componentBody(name) {
    const start = pageSource.indexOf(`function ${name}`);
    assert.notEqual(start, -1, `${name} should exist`);
    const next = pageSource.indexOf("\nfunction ", start + 1);
    return pageSource.slice(start, next === -1 ? undefined : next);
}

describe("astrology report web actions", () => {
    it("offers a text download action that preserves the AI report text outside the plugin page", () => {
        assert.match(pageSource, /function downloadReport\(report: AstrologyReport\)/);
        assert.match(pageSource, /function getReportExportText\(report: AstrologyReport\)/);
        assert.match(pageSource, /formatReportResultForExport\(report\.result\)/);
        assert.match(pageSource, /new Blob\(\[text\], \{ type: "text\/plain;charset=utf-8" \}\)/);
        assert.match(pageSource, /URL\.createObjectURL\(blob\)/);
        assert.match(pageSource, /下载/);
    });

    it("builds copy and download text from structured AI result so old resultText cannot drop review checklist", () => {
        assert.match(pageSource, /async function copyReport\(report: AstrologyReport\)/);
        assert.match(pageSource, /await copy\(getReportExportText\(report\)\)/);
        assert.match(pageSource, /const text = getReportExportText\(report\)/);
        assert.match(pageSource, /## 评分/);
        assert.match(pageSource, /scoreLabel\(key\)/);
        assert.match(pageSource, /## 幸运锚点/);
        assert.match(pageSource, /confidenceLabel\(item\.confidence\)/);
        assert.match(pageSource, /高置信/);
        assert.match(pageSource, /## 复盘清单/);
        assert.match(pageSource, /依据：\$\{item\.evidenceSource\}；验证点：\$\{item\.why\}/);
    });

    it("keeps score and lucky anchors visible in the compact report card", () => {
        const body = componentBody("ReportPanel");
        const anchorBody = componentBody("CompactAiAnchors");

        assert.match(pageSource, /function CompactAiAnchors/);
        assert.match(body, /<CompactAiAnchors result=\{result\} compact=\{compact\} \/>/);
        assert.match(pageSource, /@buildingai\/ui\/components\/ui\/badge/);
        assert.match(pageSource, /@buildingai\/ui\/components\/ui\/progress/);
        assert.match(anchorBody, /<Progress value=\{Math\.max\(0, Math\.min\(100, scoreValue\)\)\} \/>/);
        assert.match(anchorBody, /<Badge variant="outline">/);
        assert.match(pageSource, /result\.scores/);
        assert.match(pageSource, /result\.lucky/);
        assert.match(pageSource, /AI锚点/);
    });

    it("keeps all confidence tiers visible in the compact report evidence panel", () => {
        const evidenceBody = componentBody("EvidenceList");

        assert.match(pageSource, /<EvidenceList evidence=\{result\.evidence \?\? \[\]\} compact=\{compact\} \/>/);
        assert.match(evidenceBody, /slice\(0, compact \? 3 : 5\)/);
        assert.match(evidenceBody, /confidenceLabel\(item\.confidence\)/);
        assert.match(pageSource, /低置信/);
    });

    it("explains question quality as AI input guidance before generation", () => {
        const body = componentBody("QuestionQualityPanel");

        assert.match(body, /const includedChecks = quality\.checks\.filter/);
        assert.match(body, /const missingChecks = quality\.checks\.filter/);
        assert.match(body, /已包含/);
        assert.match(body, /建议补充/);
        assert.match(body, /影响输出/);
        assert.match(body, /AI 会优先把高质量问题转成判断依据、行动建议和复盘清单/);
    });

    it("makes follow-up source context visible before submitting another AI report", () => {
        const appBody = componentBody("AstrologyFortuneHomePage");
        const composerBody = componentBody("ReportComposer");

        assert.match(appBody, /const followUpSourceReport = reports\.find/);
        assert.match(appBody, /followUpSourceReport=\{followUpSourceReport\}/);
        assert.match(appBody, /onClearFollowUpSource=\{\(\) => setFollowUpSourceReportId\(null\)\}/);
        assert.match(composerBody, /followUpSourceReport: AstrologyReport \| null/);
        assert.match(composerBody, /基于上一份报告继续/);
        assert.match(composerBody, /AI 会带着这份报告的摘要、行动项、风险提醒和复盘清单继续分析/);
        assert.match(composerBody, /清除上下文/);
    });

    it("lets report feedback carry a short note into the AI improvement loop", () => {
        const appBody = componentBody("AstrologyFortuneHomePage");
        const panelBody = componentBody("FeedbackPanel");

        assert.match(appBody, /note\?: UpdateReportFeedbackParams\["note"\]/);
        assert.match(appBody, /params: \{ rating, note \}/);
        assert.match(panelBody, /useState\(report\.providerMetadata\?\.feedback\?\.note \?\? ""\)/);
        assert.match(panelBody, /<Textarea/);
        assert.match(panelBody, /哪里太泛、哪里有用/);
        assert.match(panelBody, /feedbackNote\.trim\(\) \|\| undefined/);
        assert.match(panelBody, /这条备注会进入下一次追问或同类报告的 AI 质量参考/);
    });

    it("formats report times without depending on an extra host i18n provider", () => {
        assert.doesNotMatch(pageSource, /TimeText/);
        assert.match(pageSource, /formatDateTime/);
        assert.match(pageSource, /function formatReportTime\(value\?: string \| null\)/);
        assert.match(pageSource, /formatReportTime\(report\.createdAt\)/);
    });

    it("reuses backend question quality rules for the pre-generation guidance", () => {
        assert.match(pageSource, /buildAstrologyQuestionQualityContext/);
        assert.doesNotMatch(pageSource, /function getQuestionQuality\(question: string\)/);
        assert.match(pageSource, /reportType: props\.reportType/);
        assert.match(pageSource, /focusArea: props\.focusArea/);
        assert.match(pageSource, /currentState: props\.currentState/);
    });

    it("refreshes reports when generation submission fails after a report row was created", () => {
        const appBody = componentBody("AstrologyFortuneHomePage");
        const generateToastIndex = appBody.indexOf('toast.error(getErrorMessage(error, "报告生成失败"));');
        const regenerateToastIndex = appBody.indexOf('toast.error(getErrorMessage(error, "重新生成失败"));');
        const generateRefetchIndex = appBody.indexOf("reportsQuery.refetch();", generateToastIndex);
        const regenerateRefetchIndex = appBody.indexOf("reportsQuery.refetch();", regenerateToastIndex);

        assert.ok(generateToastIndex >= 0, "generate failure toast should exist");
        assert.ok(regenerateToastIndex >= 0, "regenerate failure toast should exist");
        assert.ok(generateRefetchIndex > generateToastIndex, "generate failure should refetch reports");
        assert.ok(regenerateRefetchIndex > regenerateToastIndex, "regenerate failure should refetch reports");
    });

    it("renders structured AI actions and warnings without leaking raw objects into React", () => {
        const actionBody = componentBody("ActionList");
        const signalBody = componentBody("SignalList");
        const exportBody = pageSource.slice(pageSource.indexOf("function formatReportResultForExport"));

        assert.match(pageSource, /type ReportActionItem =/);
        assert.match(pageSource, /function formatActionItem\(item: ReportActionItem\)/);
        assert.match(pageSource, /function getActionItemTitle\(item: ReportActionItem\)/);
        assert.match(pageSource, /function formatWarningItem\(item: ReportWarningItem\)/);
        assert.match(pageSource, /function getWarningItemTitle\(item: ReportWarningItem\)/);
        const modalBody = componentBody("ReportDetailModal");

        assert.match(actionBody, /getActionItemTitle\(item\)/);
        assert.match(actionBody, /原因：\{item\.reason\}/);
        assert.match(actionBody, /时间：\{item\.timebox\}/);
        assert.match(signalBody, /getWarningItemTitle\(item\)/);
        assert.match(signalBody, /\{item\.detail\}/);
        assert.match(modalBody, /<ActionList items=\{result\.actions \?\? \[\]\} \/>/);
        assert.match(modalBody, /<SignalList items=\{result\.warnings \?\? \[\]\} \/>/);
        assert.doesNotMatch(pageSource, /function ListBlock/);
        assert.match(exportBody, /result\.actions\.map\(\(item\) => `- \$\{formatActionItem\(item\)\}`\)/);
        assert.match(exportBody, /result\.warnings\.map\(\(item\) => `- \$\{formatWarningItem\(item\)\}`\)/);
    });

    it("uses platform alert and badge components for the AI summary and report labels", () => {
        const body = componentBody("ReportPanel");
        const modalBody = componentBody("ReportDetailModal");

        assert.match(pageSource, /@buildingai\/ui\/components\/ui\/alert/);
        assert.match(body, /<Alert className="border-primary\/20 bg-primary\/5">/);
        assert.match(body, /<AlertTitle>AI 摘要结论<\/AlertTitle>/);
        assert.match(body, /<Badge variant=\{report\.status === "failed"/);
        assert.match(modalBody, /<AlertTitle>AI 摘要结论<\/AlertTitle>/);
        assert.match(modalBody, /<Badge key=\{item\} variant="secondary">/);
    });
});
