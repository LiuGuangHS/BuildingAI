import assert from "node:assert/strict";

const identifier = "echoflow-astrology-fortune";
const baseUrl = normalizeBaseUrl(
    process.env.ASTROLOGY_SMOKE_BASE_URL || process.env.BUILDINGAI_BASE_URL || "http://127.0.0.1:4090",
);
const token = process.env.ASTROLOGY_SMOKE_TOKEN || process.env.BUILDINGAI_ACCESS_TOKEN || "";
const timeoutMs = readPositiveNumber(process.env.ASTROLOGY_SMOKE_TIMEOUT_MS, 180_000);
const pollIntervalMs = readPositiveNumber(process.env.ASTROLOGY_SMOKE_POLL_INTERVAL_MS, 3_000);
const profileName = process.env.ASTROLOGY_SMOKE_PROFILE_NAME || `星盘联调档案 ${new Date().toISOString().slice(0, 10)}`;
const shouldGenerate = process.env.ASTROLOGY_SMOKE_GENERATE === "1";

if (!token) {
    throw new Error("Missing ASTROLOGY_SMOKE_TOKEN or BUILDINGAI_ACCESS_TOKEN for authenticated Web API smoke.");
}

const client = createClient({ baseUrl, token });

console.log(`[astrology-smoke] base=${baseUrl}`);
console.log(`[astrology-smoke] identifier=${identifier}`);

const generationStatus = await client.get("generation-status");
assert.equal(typeof generationStatus.canGenerate, "boolean", "generation-status must expose canGenerate");
assert.ok(generationStatus.prices, "generation-status must expose public prices");
console.log(`[astrology-smoke] canGenerate=${generationStatus.canGenerate}`);

const profile = await ensureProfile();
assert.ok(profile.id, "profile must include id");
assert.equal(profile.name, profileName);
console.log(`[astrology-smoke] profile=${profile.id}`);

const profilePage = await client.get("profiles", { pageSize: 10 });
assert.ok(Array.isArray(profilePage.items), "profiles response must be paginated");
assert.ok(profilePage.items.some((item) => item.id === profile.id), "created profile should be listable");

const initialReports = await client.get("reports", { page: 1, pageSize: 5 });
assertPublicReportPage(initialReports);
console.log(`[astrology-smoke] listedReports=${initialReports.items.length}`);

if (!shouldGenerate) {
    console.log("[astrology-smoke] generation skipped; set ASTROLOGY_SMOKE_GENERATE=1 after real model, Secret, balance, Redis and Worker are ready.");
    console.log("[astrology-smoke] smoke passed: public status/profile/list boundaries are reachable.");
    process.exit(0);
}

if (!generationStatus.canGenerate) {
    throw new Error(`Generation is unavailable: ${generationStatus.unavailableReason || "unknown reason"}`);
}

const report = await client.post("reports/generate", {
    reportType: "daily",
    profileId: profile.id,
    focusArea: "真实联调今日节奏",
    currentState: "验证真实模型、队列、计费和结构化报告是否可用。",
    question: "今天我最应该优先验证哪个产品风险，应该观察什么信号？",
    language: "zh-CN",
});
assertPublicReport(report);
assert.ok(report.id, "generated report must include id");
console.log(`[astrology-smoke] reportSubmitted=${report.id} status=${report.status}`);

const finishedReport = await pollReport(report.id);
assertPublicReport(finishedReport);
console.log(`[astrology-smoke] reportFinal=${finishedReport.status}`);

if (finishedReport.status !== "success") {
    assert.ok(finishedReport.errorMessage, "failed report should expose a user-safe errorMessage");
    console.log("[astrology-smoke] report failed; verify refund by账务事实 in Console before claiming full E2E pass.");
    process.exit(1);
}

assertStructuredAiResult(finishedReport.result);
assert.ok(finishedReport.providerMetadata?.generationContext, "public report should expose sanitized generationContext");
assertNoPrivateReportFields(finishedReport);

const feedbackReport = await client.patch(`reports/${finishedReport.id}/feedback`, {
    rating: "useful",
    note: "真实联调 smoke：结构清晰，继续追问会引用本报告。",
});
assertPublicReport(feedbackReport);
assert.equal(feedbackReport.providerMetadata?.feedback?.rating, "useful");

const followUpReport = await client.post("reports/generate", {
    reportType: "daily",
    profileId: profile.id,
    focusArea: "基于上一份报告继续细化",
    currentState: "已经有一份成功报告，希望验证追问上下文。",
    question: "把上一份报告拆成今天能执行的三步。",
    language: "zh-CN",
    sourceReportId: finishedReport.id,
});
assertPublicReport(followUpReport);
assert.ok(followUpReport.providerMetadata?.sourceReport || followUpReport.providerMetadata?.generationContext?.sourceReportId, "follow-up should keep sanitized source context");

console.log(`[astrology-smoke] followUpSubmitted=${followUpReport.id}`);
console.log("[astrology-smoke] smoke passed: generation, structured result, feedback and follow-up source boundaries are reachable.");

async function ensureProfile() {
    const existing = await client.get("profiles", { pageSize: 50, keyword: profileName });
    assert.ok(Array.isArray(existing.items), "profile search must be paginated");
    const found = existing.items.find((item) => item.name === profileName);
    if (found) return found;
    return client.post("profiles", {
        name: profileName,
        gender: "other",
        birthDate: "1995-08-17",
        birthTime: "08:30",
        birthPlace: "上海",
        zodiacSign: "狮子座",
        moonSign: "天秤座",
        risingSign: "处女座",
    });
}

async function pollReport(reportId) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const report = await client.get(`reports/${reportId}`);
        if (report.status === "success" || report.status === "failed") return report;
        await sleep(pollIntervalMs);
    }
    throw new Error(`Timed out waiting for report ${reportId} after ${timeoutMs}ms`);
}

function createClient({ baseUrl, token }) {
    return {
        get: (path, query) => request("GET", path, { query }),
        post: (path, body) => request("POST", path, { body }),
        patch: (path, body) => request("PATCH", path, { body }),
    };

    async function request(method, path, { body, query } = {}) {
        const url = new URL(`/${identifier}/api/astrology-fortune/${path}`, baseUrl);
        for (const [key, value] of Object.entries(query ?? {})) {
            if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
        }
        const response = await fetch(url, {
            method,
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        const raw = await response.text();
        let payload;
        try {
            payload = raw ? JSON.parse(raw) : null;
        } catch (error) {
            throw new Error(`${method} ${url.pathname} returned non-JSON ${response.status}: ${raw.slice(0, 200)}`);
        }
        if (!response.ok) {
            throw new Error(`${method} ${url.pathname} failed ${response.status}: ${raw.slice(0, 300)}`);
        }
        assertStandardEnvelope(payload, `${method} ${url.pathname}`);
        return payload.data;
    }
}

function assertStandardEnvelope(payload, label) {
    assert.ok(payload && typeof payload === "object", `${label} must return standard envelope`);
    assert.equal(typeof payload.code, "number", `${label} envelope must contain numeric code`);
    assert.ok(payload.code >= 20000 && payload.code < 30000, `${label} envelope must be success: ${payload.message ?? payload.code}`);
    assert.ok("data" in payload, `${label} envelope must contain data`);
}

function assertPublicReportPage(page) {
    assert.ok(Array.isArray(page.items), "reports response must be paginated");
    page.items.forEach(assertPublicReport);
}

function assertPublicReport(report) {
    assert.ok(report && typeof report === "object", "report must be an object");
    assert.ok(report.id, "report must include id");
    assert.ok(report.reportType, "report must include reportType");
    assert.ok(report.status, "report must include status");
    assertNoPrivateReportFields(report);
}

function assertNoPrivateReportFields(report) {
    for (const privateField of [
        "userId",
        "modelId",
        "providerId",
        "requestPayload",
        "rawRequest",
        "rawResponse",
        "baseURL",
        "secretId",
        "aiRepairAttempted",
        "aiRepairSucceeded",
        "aiRepairReason",
    ]) {
        assert.equal(report[privateField], undefined, `public report must not expose ${privateField}`);
    }
}

function assertStructuredAiResult(result) {
    assert.ok(result && typeof result === "object", "successful report must expose structured result");
    assertNonEmptyString(result.title, "result.title");
    assertNonEmptyString(result.summary, "result.summary");
    assert.ok(result.scores && typeof result.scores === "object", "result.scores must exist");
    assert.equal(typeof result.scores.overall, "number", "result.scores.overall must be numeric");
    assert.ok(Array.isArray(result.keywords) && result.keywords.length >= 2, "result.keywords must have at least 2 items");
    assert.ok(result.lucky?.color && typeof result.lucky.number === "number" && result.lucky.direction && result.lucky.timeRange, "result.lucky must be complete");
    assert.ok(Array.isArray(result.evidence) && result.evidence.length >= 2, "result.evidence must have at least 2 items");
    const confidenceValues = new Set(["low", "medium", "high"]);
    for (const evidence of result.evidence) {
        assertNonEmptyString(evidence.source, "evidence.source");
        assertNonEmptyString(evidence.insight, "evidence.insight");
        assert.ok(confidenceValues.has(evidence.confidence), `evidence.confidence must be low, medium or high: ${evidence.confidence}`);
    }
    assert.ok(Array.isArray(result.reviewChecklist) && result.reviewChecklist.length >= 2, "result.reviewChecklist must have at least 2 items");
    assert.ok(Array.isArray(result.followUps) && result.followUps.length >= 2, "result.followUps must have at least 2 items");
    assert.ok(Array.isArray(result.actions) && result.actions.length >= 3, "result.actions must have at least 3 items");
    for (const action of result.actions) {
        assertNonEmptyString(action.item, "action.item");
        assertNonEmptyString(action.reason, "action.reason");
        assertNonEmptyString(action.timebox, "action.timebox");
    }
    assert.ok(Array.isArray(result.warnings) && result.warnings.length >= 2, "result.warnings must have at least 2 items");
    for (const warning of result.warnings) {
        assertNonEmptyString(warning.title, "warning.title");
        assertNonEmptyString(warning.detail, "warning.detail");
    }
}

function assertNonEmptyString(value, label) {
    assert.equal(typeof value, "string", `${label} must be a string`);
    assert.ok(value.trim(), `${label} must not be empty`);
}

function normalizeBaseUrl(value) {
    return value.replace(/\/+$/, "");
}

function readPositiveNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
