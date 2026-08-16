import { readFile } from "node:fs/promises";
import path from "node:path";

describe("ExtensionConsoleController plugin layout boundary", () => {
    it("does not execute extension build or source code to resolve console menus", async () => {
        const source = await readFile(path.join(__dirname, "extension.controller.ts"), "utf8");

        expect(source).not.toContain("new Function(");
        expect(source).not.toContain("router.options.js");
        expect(source).not.toContain("router.options.ts");
        expect(source).toContain("consoleMenu: null");
    });
});
