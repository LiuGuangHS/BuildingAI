import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const entity = readFileSync(new URL("../src/api/db/entities/contract-template.entity.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../src/api/db/migrations/1781539200003-0.0.1-template-governance.ts", import.meta.url), "utf8");
const upgrade = readFileSync(new URL("../src/api/upgrade/0.0.1/index.ts", import.meta.url), "utf8");
const service = readFileSync(new URL("../src/api/modules/contract-generation/services/contract-generation.service.ts", import.meta.url), "utf8");
const webController = readFileSync(new URL("../src/api/modules/contract-generation/controllers/web/contract-generation.web.controller.ts", import.meta.url), "utf8");
const consoleController = readFileSync(new URL("../src/api/modules/contract-generation/controllers/console/contract-generation.controller.ts", import.meta.url), "utf8");
const dto = readFileSync(new URL("../src/api/modules/contract-generation/dto/contract-generation.dto.ts", import.meta.url), "utf8");

test("same-version upgrade exposes an idempotent schema repair path", () => {
    assert.match(upgrade, /ensureContractSchema/);
    assert.match(upgrade, /ADD COLUMN IF NOT EXISTS/);
    assert.match(upgrade, /CREATE UNIQUE INDEX IF NOT EXISTS/);
    assert.match(upgrade, /contract_schema_repairs/);
    assert.match(upgrade, /pg_advisory_xact_lock/);
    assert.match(upgrade, /postcondition/i);
});

test("template rows carry lifecycle status and an immutable version number", () => {
    assert.match(entity, /status: "draft" \| "published" \| "offline"/);
    assert.match(entity, /versionNo: number/);
    assert.match(migration, /template_status/);
    assert.match(migration, /template_version_no/);
    assert.match(readFileSync(new URL("../src/api/db/migrations/1781539200001-0.0.1-init-contract-generation.ts", import.meta.url), "utf8"), /template_status/);
});

test("only one effective published template is allowed for the same name and type", () => {
    assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS "uq_contract_templates_published_name_type"/);
    assert.match(migration, /WHERE "template_status" = 'published'/);
    assert.match(service, /pessimistic_write/);
    assert.match(service, /publishTemplate/);
});

test("template updates clone published or used versions instead of mutating them", () => {
    assert.match(service, /taskRepo\.count/);
    assert.match(service, /status: "draft"/);
    assert.match(service, /versionNo: template\.versionNo \+ 1/);
});

test("admin template responses use an explicit serializer", () => {
    assert.match(service, /templates\.map\(\(template\) => this\.toAdminTemplate\(template\)\)/);
    assert.match(service, /private toAdminTemplate\(template: ContractTemplateEntity\)/);
    assert.doesNotMatch(service, /return this\.templateRepo\.find\(\{ order/);
});

test("web receives only published template serializers while console owns lifecycle routes", () => {
    assert.match(service, /where: \{ status: "published" \}/);
    assert.doesNotMatch(webController, /publishTemplate|offlineTemplate/);
    assert.match(consoleController, /templates\/:id\/publish/);
    assert.match(consoleController, /templates\/:id\/offline/);
    assert.doesNotMatch(dto, /isActive\?: boolean/);
});

test("interactive review requires stable section evidence", () => {
    assert.match(service, /const reviewRiskSchema = riskSchema\.extend/);
    assert.match(service, /sectionId: z\.string\(\)\.min\(1\)/);
    assert.match(service, /quote: z\.string\(\)\.min\(1\)/);
    assert.match(service, /sectionId=\$\{section\.id/);
});
