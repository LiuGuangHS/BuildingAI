import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pluginServices = [
    new URL("../src/api/modules/generation/services/generation.service.ts", import.meta.url),
    new URL("../../echoflow-video/src/api/modules/generation/services/generation.service.ts", import.meta.url),
    new URL("../../echoflow-video/src/api/modules/generation/services/prompt-optimization.service.ts", import.meta.url),
    new URL("../../echoflow-contract-generation/src/api/modules/contract-generation/services/contract-generation.service.ts", import.meta.url),
    new URL("../../echoflow-astrology-fortune/src/api/modules/astrology-fortune/services/astrology-fortune.service.ts", import.meta.url),
];

const pluginModules = [
    new URL("../src/api/modules/generation/generation.module.ts", import.meta.url),
    new URL("../../echoflow-video/src/api/modules/generation/generation.module.ts", import.meta.url),
    new URL("../../echoflow-contract-generation/src/api/modules/contract-generation/contract-generation.module.ts", import.meta.url),
    new URL("../../echoflow-astrology-fortune/src/api/modules/astrology-fortune/astrology-fortune.module.ts", import.meta.url),
];

test("plugin services use ExtensionBillingService instead of querying AccountLog", () => {
    for (const file of pluginServices) {
        const source = readFileSync(file, "utf8");

        assert.match(source, /\bExtensionBillingService\b/);
        assert.match(source, /\.hasBillingLog\(/);
        assert.doesNotMatch(source, /\bAccountLog\b/);
        assert.doesNotMatch(source, /\bACCOUNT_LOG_TYPE\b/);
        assert.doesNotMatch(source, /getRepository\(AccountLog\)/);
        assert.doesNotMatch(source, /InjectRepository\(AccountLog\)/);
    }
});

test("plugin modules do not register main AccountLog as a feature entity", () => {
    for (const file of pluginModules) {
        const source = readFileSync(file, "utf8");

        assert.doesNotMatch(source, /\bAccountLog\b/);
    }
});

