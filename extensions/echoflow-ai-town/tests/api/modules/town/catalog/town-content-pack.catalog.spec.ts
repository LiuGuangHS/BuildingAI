import { normalizeTownContentPackState, createTownContentPackState, TOWN_CONTENT_PACK_MANIFEST } from "../../../../../src/api/modules/town/catalog/town-content-pack.catalog";

describe("normalizeTownContentPackState", () => {
    it("returns defaults for null/undefined input", () => {
        const result = normalizeTownContentPackState(null);
        expect(result.packId).toBe("launch-core");
        expect(result.version).toBe("0.0.1");
        expect(result.seasonId).toBe("season-0");
        expect(result.seedStrategy.mode).toBe("first-install");
        expect(result.seedStrategy.idempotencyKey).toBe("echoflow-ai-town:launch-core:0.0.1");
    });

    it("preserves valid packId", () => {
        const result = normalizeTownContentPackState({ packId: "launch-core" });
        expect(result.packId).toBe("launch-core");
    });

    it("rejects invalid packId", () => {
        const result = normalizeTownContentPackState({ packId: "evil-pack" });
        expect(result.packId).toBe("launch-core");
    });

    it("validates seasonId against whitelist", () => {
        const result = normalizeTownContentPackState({ seasonId: "evil-season" });
        expect(result.seasonId).toBe("season-0");
    });

    it("validates seedStrategy with partial corruption", () => {
        const result = normalizeTownContentPackState({
            seedStrategy: {
                mode: "evil-mode",
                shouldRun: "evil-run",
                idempotencyKey: "",
            },
        });
        expect(result.seedStrategy.mode).toBe("first-install");
        expect(result.seedStrategy.shouldRun).toBe("create-save");
        expect(result.seedStrategy.idempotencyKey).toBe("echoflow-ai-town:launch-core:0.0.1");
    });

    it("preserves valid seedStrategy", () => {
        const result = normalizeTownContentPackState({
            seedStrategy: {
                mode: "first-install",
                shouldRun: "upgrade-normalize",
                idempotencyKey: "custom-key",
            },
        });
        expect(result.seedStrategy.mode).toBe("first-install");
        expect(result.seedStrategy.shouldRun).toBe("upgrade-normalize");
        expect(result.seedStrategy.idempotencyKey).toBe("custom-key");
    });

    it("deep-copies seedStrategy to prevent mutation", () => {
        const source = {
            seedStrategy: {
                mode: "first-install" as const,
                shouldRun: "create-save" as const,
                idempotencyKey: "test-key",
            },
        };
        const result = normalizeTownContentPackState(source);
        source.seedStrategy.idempotencyKey = "mutated";
        expect(result.seedStrategy.idempotencyKey).toBe("test-key");
    });

    it("returns fallback for empty string versions", () => {
        const result = normalizeTownContentPackState({ version: "   " });
        expect(result.version).toBe("0.0.1");
    });
});

describe("createTownContentPackState", () => {
    it("includes seasonId and seedStrategy defaults", () => {
        const result = createTownContentPackState();
        expect(result.seasonId).toBe("season-0");
        expect(result.seedStrategy).toBeDefined();
        expect(result.seedStrategy.mode).toBe("first-install");
    });
});