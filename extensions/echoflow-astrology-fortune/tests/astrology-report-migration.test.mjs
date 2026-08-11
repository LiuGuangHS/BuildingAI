import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const initialMigration = readFileSync(new URL("../src/api/db/migrations/1781539200002-0.0.1-init-astrology-fortune.ts", import.meta.url), "utf8");
const migrationSource = readFileSync(new URL("../src/api/db/migrations/1781539200003-0.0.1-add-astrology-report-request-key.ts", import.meta.url), "utf8");
const entitySource = readFileSync(new URL("../src/api/db/entities/astrology-report.entity.ts", import.meta.url), "utf8");

 describe("astrology report request key schema", () => {
    it("keeps the initial migration immutable and adds a repeatable partial unique index", () => {
        assert.doesNotMatch(initialMigration, /request_key/);
        assert.match(migrationSource, /ADD COLUMN IF NOT EXISTS/);
        assert.match(migrationSource, /CREATE UNIQUE INDEX IF NOT EXISTS/);
        assert.match(migrationSource, /request_key/);
        assert.match(migrationSource, /deleted_at\" IS NULL/);
        assert.match(entitySource, /requestKey\?: string \| null/);
        assert.match(entitySource, /uq_astrology_reports_user_request_key/);
        assert.match(entitySource, /request_key.*IS NOT NULL/);
    });
});
