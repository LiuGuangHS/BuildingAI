import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const PACKAGE_FILE = new URL("../package.json", import.meta.url);
const MANIFEST_FILE = new URL("../manifest.json", import.meta.url);
const UPGRADE_FILE = new URL("../src/api/upgrade/0.0.2/index.ts", import.meta.url);
const DTO_FILE = new URL("../src/api/modules/generation/dto/create-video-generation.dto.ts", import.meta.url);
const MODEL_SERVICE_FILE = new URL("../src/api/modules/generation/services/model-config.service.ts", import.meta.url);

test("video package and manifest use the additive 0.0.2 upgrade", async () => {
    const [pkg, manifest, upgrade] = await Promise.all([
        readFile(PACKAGE_FILE, "utf8").then(JSON.parse),
        readFile(MANIFEST_FILE, "utf8").then(JSON.parse),
        readFile(UPGRADE_FILE, "utf8"),
    ]);

    assert.equal(pkg.version, "0.0.2");
    assert.equal(manifest.version, "0.0.2");
    assert.match(upgrade, /ADD COLUMN IF NOT EXISTS/);
    assert.match(upgrade, /uq_video_model_config_main_model/);
    assert.match(upgrade, /ALTER COLUMN "model" DROP NOT NULL/);
    assert.match(upgrade, /ALTER COLUMN "display_name" DROP NOT NULL/);
    assert.match(upgrade, /UPDATE "extension" SET "version" = \$1/);
    assert.doesNotMatch(upgrade, /INSERT INTO .*video_model_config/s);
    assert.doesNotMatch(upgrade, /main_model_id.*gen_random_uuid/s);
});

test("video upgrade fails closed for legacy model rows", async () => {
    const source = await readFile(UPGRADE_FILE, "utf8");

    assert.match(source, /main_model_id\" IS NULL/);
    assert.match(source, /apiContractVerified/);
    assert.match(source, /enabled\" = false/s);
    assert.match(source, /visible_to_user\" = false/s);
});

test("video creation accepts only a model configuration id", async () => {
    const [dto, service] = await Promise.all([
        readFile(DTO_FILE, "utf8"),
        readFile(MODEL_SERVICE_FILE, "utf8"),
    ]);

    assert.match(dto, /@IsUUID\("4"\)\s+modelConfigId: string/);
    assert.doesNotMatch(dto, /\n\s+model: string;/);
    assert.match(service, /findEnabledById\(modelConfigId: string\)/);
    assert.doesNotMatch(service, /findEnabledByModel/);
});
