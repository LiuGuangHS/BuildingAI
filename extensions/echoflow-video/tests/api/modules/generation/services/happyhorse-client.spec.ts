/// <reference path="../../../jest-globals.d.ts" />

import {
    HappyHorseClient,
    isSuccessStatus,
    isFailedStatus,
    isTerminalStatus,
} from "../../../../../src/api/modules/generation/services/happyhorse-client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createFetchMock(responseOverrides: {
    status?: number;
    body?: unknown;
    delayMs?: number;
}): typeof globalThis.fetch {
    const { status = 200, body = {}, delayMs = 0 } = responseOverrides;

    return (async (_url: RequestInfo | URL, _options?: RequestInit) => {
        if (delayMs > 0) {
            await new Promise((r) => setTimeout(r, delayMs));
        }
        return {
            ok: status >= 200 && status < 300,
            status,
            text: async () => JSON.stringify(body),
        } as Response;
    }) as unknown as typeof globalThis.fetch;
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

describe("isSuccessStatus", () => {
    it("recognizes happyhorse success values", () => {
        expect(isSuccessStatus("succeeded")).toBe(true);
        expect(isSuccessStatus("success")).toBe(true);
        expect(isSuccessStatus("SUCCEEDED")).toBe(true);
    });

    it("returns false for non-success values", () => {
        expect(isSuccessStatus("processing")).toBe(false);
        expect(isSuccessStatus("failed")).toBe(false);
        expect(isSuccessStatus("")).toBe(false);
    });
});

describe("isFailedStatus", () => {
    it("recognizes happyhorse failure values", () => {
        expect(isFailedStatus("failed")).toBe(true);
        expect(isFailedStatus("cancelled")).toBe(true);
        expect(isFailedStatus("FAILED")).toBe(true);
        expect(isFailedStatus("CANCELED")).toBe(true);
    });

    it("returns false for non-failure values", () => {
        expect(isFailedStatus("processing")).toBe(false);
        expect(isFailedStatus("succeeded")).toBe(false);
    });
});

describe("isTerminalStatus", () => {
    it("returns true for success or failure", () => {
        expect(isTerminalStatus("succeeded")).toBe(true);
        expect(isTerminalStatus("failed")).toBe(true);
    });

    it("returns false for in-progress status", () => {
        expect(isTerminalStatus("pending")).toBe(false);
        expect(isTerminalStatus("processing")).toBe(false);
        expect(isTerminalStatus("")).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// HappyHorseClient
// ---------------------------------------------------------------------------

describe("HappyHorseClient", () => {
    const realFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = realFetch;
    });

    describe("constructor", () => {
        it("throws when apiKey is empty", () => {
            expect(() => new HappyHorseClient("")).toThrow("主站密钥");
        });

        it("creates instance with valid apiKey", () => {
            const client = new HappyHorseClient("sk-test");
            expect(client).toBeInstanceOf(HappyHorseClient);
        });

        it("rejects unsafe baseUrl values", () => {
            expect(() => new HappyHorseClient("sk-test", { baseUrl: "ftp://api.example.com" })).toThrow("http/https");
            expect(() => new HappyHorseClient("sk-test", { baseUrl: "https://user:pass@example.com" })).toThrow("用户名或密码");
            expect(() => new HappyHorseClient("sk-test", { baseUrl: "http://127.0.0.1:8080" })).toThrow("本机或内网");
            expect(() => new HappyHorseClient("sk-test", { baseUrl: "   " })).toThrow("不能为空");
        });
    });

    describe("submitTask", () => {
        it("returns taskId from happyhorse response", async () => {
            globalThis.fetch = createFetchMock({
                body: { output: { task_id: "hh-task-001" } },
            });

            const client = new HappyHorseClient("sk-test");
            const result = await client.submitTask({
                model: "happyhorse-1.0-t2v" as never,
                prompt: "a sunset",
            });

            expect(result.taskId).toBe("hh-task-001");
            expect(result.rawRequest).toBeDefined();
            expect(result.rawResponse).toBeDefined();
        });

        it("throws when response has no task_id", async () => {
            globalThis.fetch = createFetchMock({
                body: { output: {} },
            });

            const client = new HappyHorseClient("sk-test");
            await expect(
                client.submitTask({
                    model: "happyhorse-1.0-t2v" as never,
                    prompt: "test",
                }),
            ).rejects.toThrow("task_id");
        });

        it("throws on 401 without retry", async () => {
            let callCount = 0;
            globalThis.fetch = (async (_url, _opts) => {
                callCount++;
                return {
                    ok: false,
                    status: 401,
                    text: async () => JSON.stringify({ error: "unauthorized" }),
                } as Response;
            }) as typeof globalThis.fetch;

            const client = new HappyHorseClient("sk-bad");
            await expect(
                client.submitTask({
                    model: "happyhorse-1.0-t2v" as never,
                    prompt: "test",
                }),
            ).rejects.toThrow("主站密钥中的 apiKey 无效");

            expect(callCount).toBe(1); // no retries for 401
        });

        it("retries on 500 and eventually succeeds", async () => {
            let callCount = 0;
            globalThis.fetch = (async (_url, _opts) => {
                callCount++;
                if (callCount <= 2) {
                    return {
                        ok: false,
                        status: 500,
                        text: async () => "Internal Server Error",
                    } as Response;
                }
                return {
                    ok: true,
                    status: 200,
                    text: async () =>
                        JSON.stringify({ output: { task_id: "hh-task-retry" } }),
                } as Response;
            }) as typeof globalThis.fetch;

            const client = new HappyHorseClient("sk-test");
            // Override the retry delay for fast tests
            const result = await client.submitTask({
                model: "happyhorse-1.0-i2v" as never,
                prompt: "test",
            });

            expect(result.taskId).toBe("hh-task-retry");
            expect(callCount).toBe(3); // 2 failures + 1 success
        }, 10_000); // allow up to 10s for retries with real delays

        it("includes media in request body", async () => {
            let capturedBody: string | undefined;
            globalThis.fetch = (async (_url, opts) => {
                capturedBody = (opts as RequestInit).body as string;
                return {
                    ok: true,
                    status: 200,
                    text: async () =>
                        JSON.stringify({ output: { task_id: "hh-media" } }),
                } as Response;
            }) as typeof globalThis.fetch;

            const client = new HappyHorseClient("sk-test");
            await client.submitTask({
                model: "happyhorse-1.0-i2v" as never,
                prompt: "test",
                media: [
                    { type: "first_frame" as const, url: "https://example.com/img.jpg" },
                ],
            });

            const parsed = JSON.parse(capturedBody!);
            expect(parsed.input.media).toHaveLength(1);
            expect(parsed.input.media[0].url).toBe("https://example.com/img.jpg");
        });
    });

    describe("pollTask", () => {
        it("returns status and videoUrl from response", async () => {
            globalThis.fetch = createFetchMock({
                body: {
                    status: "succeeded",
                    output: { video_url: "https://cdn.example.com/video.mp4" },
                },
            });

            const client = new HappyHorseClient("sk-test");
            const result = await client.pollTask("hh-task-001");

            expect(result.status).toBe("succeeded");
            expect(result.videoUrl).toBe("https://cdn.example.com/video.mp4");
        });

        it("handles processing status", async () => {
            globalThis.fetch = createFetchMock({
                body: { status: "processing" },
            });

            const client = new HappyHorseClient("sk-test");
            const result = await client.pollTask("hh-task-001");

            expect(result.status).toBe("processing");
            expect(result.videoUrl).toBeUndefined();
        });

        it("handles failed status", async () => {
            globalThis.fetch = createFetchMock({
                body: { status: "failed" },
            });

            const client = new HappyHorseClient("sk-test");
            const result = await client.pollTask("hh-task-001");

            expect(result.status).toBe("failed");
            expect(result.videoUrl).toBeUndefined();
        });
    });

    describe("testConnection", () => {
        it("resolves when endpoint returns 200", async () => {
            globalThis.fetch = createFetchMock({ status: 200, body: {} });

            const client = new HappyHorseClient("sk-test");
            await expect(client.testConnection()).resolves.toBeUndefined();
        });

        it("resolves when endpoint returns 404 (legacy compat)", async () => {
            globalThis.fetch = createFetchMock({ status: 404, body: {} });

            const client = new HappyHorseClient("sk-test");
            await expect(client.testConnection()).resolves.toBeUndefined();
        });

        it("throws on 401", async () => {
            globalThis.fetch = createFetchMock({ status: 401, body: {} });

            const client = new HappyHorseClient("sk-test");
            await expect(client.testConnection()).rejects.toThrow();
        });
    });
});
