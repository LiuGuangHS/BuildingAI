import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const WECHAT_MODULE_FILE = new URL("./wechat.module.ts", import.meta.url);

test("wechat module reuses channel module providers for wx oa config", async () => {
    const source = await readFile(WECHAT_MODULE_FILE, "utf8");

    assert.match(source, /ChannelModule/);
    assert.doesNotMatch(source, /WxOaConfigService/);
    assert.doesNotMatch(source, /providers:\s*\[[^\]]*WxOaConfigService/s);
});

test("wechat module imports the complete auth module instead of reproviding auth service", async () => {
    const source = await readFile(WECHAT_MODULE_FILE, "utf8");

    assert.match(source, /AuthModule/);
    assert.match(source, /imports:\s*\[[^\]]*AuthModule[^\]]*\]/s);
    assert.doesNotMatch(source, /import\s*\{\s*AuthService\s*\}/);
    assert.doesNotMatch(source, /providers:\s*\[[^\]]*AuthService[^\]]*\]/s);
});
