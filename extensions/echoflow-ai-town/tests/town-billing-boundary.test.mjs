import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const moduleSource = readFileSync(new URL("../src/api/modules/town/town.module.ts", import.meta.url), "utf8");
const serviceSource = readFileSync(new URL("../src/api/modules/town/services/town.service.ts", import.meta.url), "utf8");
const aiServiceSource = readFileSync(new URL("../src/api/modules/town/services/town-ai.service.ts", import.meta.url), "utf8");
const aiRulesSource = readFileSync(new URL("../src/api/modules/town/services/town-ai-rules.mjs", import.meta.url), "utf8");
const entitySource = readFileSync(new URL("../src/api/db/entities/town-ai-config.entity.ts", import.meta.url), "utf8");
const dtoSource = readFileSync(new URL("../src/api/modules/town/dto/town.dto.ts", import.meta.url), "utf8");
const migrationSource = readFileSync(new URL("../src/api/db/migrations/1781539200003-0.0.1-init-ai-town.ts", import.meta.url), "utf8");
const upgradeSource = readFileSync(new URL("../src/api/upgrade/0.0.1/index.ts", import.meta.url), "utf8");
const webTypesSource = readFileSync(new URL("../src/web/services/types.ts", import.meta.url), "utf8");
const consoleSource = readFileSync(new URL("../src/web/pages/console/ai-config.tsx", import.meta.url), "utf8");
const gamePanelsSource = readFileSync(new URL("../src/web/components/game-panels.tsx", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("../src/web/styles/index.css", import.meta.url), "utf8");
const readmeSource = readFileSync(new URL("../README.md", import.meta.url), "utf8");

function methodBody(name) {
    const start = serviceSource.search(new RegExp(`\\n    (private async |async |private )${name}\\(`));
    assert.notEqual(start, -1, `${name} should exist`);
    const nextPrivate = serviceSource.indexOf("\n    private ", start + 1);
    const nextPublic = serviceSource.indexOf("\n    async ", start + 1);
    const next = [nextPrivate, nextPublic].filter((index) => index > start).sort((a, b) => a - b)[0];
    return serviceSource.slice(start, next === -1 ? undefined : next);
}

test("town AI billing config is explicit and defaults to free", () => {
    for (const field of ["adviceCostPower", "chatCostPower", "eventCostPower"]) {
        assert.match(entitySource, new RegExp(`${field}!: number`));
        assert.match(dtoSource, new RegExp(`${field}\\?: number`));
        assert.match(aiRulesSource, new RegExp(`${field}: 0`));
        assert.match(migrationSource, new RegExp(`"${field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}" int NOT NULL DEFAULT 0`));
        assert.match(upgradeSource, new RegExp(`ADD COLUMN IF NOT EXISTS "${field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}" int NOT NULL DEFAULT 0`));
        assert.match(webTypesSource, new RegExp(`${field}: number`));
        assert.match(consoleSource, new RegExp(`value=\\{form\\.${field}\\}`));
    }
});

test("town module imports extension billing instead of touching account logs directly", () => {
    assert.match(moduleSource, /ExtensionBillingModule/);
    assert.match(moduleSource, /imports: \[[\s\S]*ExtensionBillingModule/);
    assert.match(serviceSource, /ExtensionBillingService/);
    assert.doesNotMatch(serviceSource, /AccountLog/);
});

test("town AI billing uses event ids as association numbers and skips fallback or free calls", () => {
    const actionBody = methodBody("runAction");
    const chatBody = methodBody("chat");
    const reserveBody = methodBody("reserveTownAiBillingOnce");

    assert.match(actionBody, /const savedEvent = await manager\.save\(\s*TownEvent,/);
    assert.match(actionBody, /await this\.reserveTownAiBillingOnce\(savedEvent, preparedAi\?\.billing, manager\)/);
    assert.match(chatBody, /const savedEvent = await manager\.save\(\s*TownEvent,/);
    assert.match(chatBody, /await this\.reserveTownAiBillingOnce\(savedEvent, replyResult\.billing, manager\)/);
    assert.match(reserveBody, /if \(!billing \|\| billing\.fallbackUsed \|\| billing\.amount <= 0\) return;/);
    assert.match(reserveBody, /this\.billingService\.hasBillingLog\(\{ associationNo: event\.id, action: ACTION\.DEC \}, manager\)/);
    assert.match(reserveBody, /this\.billingService\.deductUserPower\(\{ userId: event\.userId, amount: billing\.amount/);
    assert.match(reserveBody, /associationNo: event\.id/);
    assert.match(reserveBody, /billingStatus: "deducted"/);
});

test("town AI generation failure refunds deducted event billing facts before surfacing the error", () => {
    const refundBody = methodBody("refundTownAiBillingIfNeeded");
    const actionBody = methodBody("runAction");
    const chatBody = methodBody("chat");

    assert.match(actionBody, /catch \(error\)[\s\S]*await this\.refundTownAiBillingIfNeeded/);
    assert.match(chatBody, /catch \(error\)[\s\S]*await this\.refundTownAiBillingIfNeeded/);
    assert.match(refundBody, /lock: \{ mode: "pessimistic_write" \}, withDeleted: true/);
    assert.match(refundBody, /metadata\.billingStatus === "deducted"/);
    assert.match(refundBody, /this\.billingService\.hasBillingLog\(\{ associationNo: event\.id, action: ACTION\.DEC \}, manager\)/);
    assert.match(refundBody, /this\.billingService\.hasBillingLog\(\{ associationNo: event\.id, action: ACTION\.INC \}, manager\)/);
    assert.match(refundBody, /this\.billingService\.addUserPower\(\{ userId: event\.userId, amount: Number\(metadata\.billingAmount/);
    assert.match(refundBody, /billingStatus: "refunded"/);
    assert.match(refundBody, /refundError: refundMessage/);
});

test("town user result cards expose billing facts without model or provider details", () => {
    assert.match(gamePanelsSource, /function formatBillingFact\(event: TownEvent\)/);
    assert.match(gamePanelsSource, /event\.result\?\.billingStatus === "refunded"/);
    assert.match(gamePanelsSource, /已按账务事实退款/);
    assert.match(gamePanelsSource, /已扣费/);
    assert.match(gamePanelsSource, /退款异常/);
    assert.match(gamePanelsSource, /className=\{event\.result\.refundError \? "billing-chip warning" : "billing-chip"\}/);
    assert.match(stylesSource, /\.billing-chip/);
    assert.doesNotMatch(gamePanelsSource, /Provider|secretId|defaultModelId/);
});

test("town README documents billing as ready but still not a purchase entry", () => {
    assert.match(readmeSource, /正式计费 \| ready \|/);
    assert.match(readmeSource, /事件 ID 作为 `associationNo`/);
    assert.match(readmeSource, /默认价格为 0 时不扣费/);
    assert.match(readmeSource, /成长册仍不是购买入口/);
});
