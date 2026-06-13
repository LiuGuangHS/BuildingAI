import { test, expect } from "@playwright/test";

/**
 * E2E tests for Echoflow Video plugin.
 *
 * Prerequisites:
 * 1. BuildingAI server running on localhost:4090
 * 2. Logged-in user session (provide ADMIN_AUTH_TOKEN env var)
 * 3. HappyHorse API Key configured via Console Admin UI
 *
 * Run: npx playwright test tests/e2e/
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:4090";
const ADMIN_AUTH_TOKEN = process.env.ADMIN_AUTH_TOKEN || "";
const WEB_USER_AUTH_TOKEN = process.env.WEB_USER_AUTH_TOKEN || "";
const EXTENSION_BASE = `${BASE_URL}/extension/echoflow-video`;

const consoleApi = (path: string) => `${EXTENSION_BASE}/consoleapi${path}`;
const webApi = (path: string) => `${EXTENSION_BASE}/api${path}`;

const adminHeaders = {
    Authorization: `Bearer ${ADMIN_AUTH_TOKEN}`,
    "Content-Type": "application/json",
};

const userHeaders = {
    Authorization: `Bearer ${WEB_USER_AUTH_TOKEN}`,
    "Content-Type": "application/json",
};

// ──────────────────────────────────────────────
// Admin Config Flow
// ──────────────────────────────────────────────

test.describe("Admin: Provider Config", () => {
    test("GET /config returns current provider config", async ({ request }) => {
        const res = await request.get(consoleApi("/generation/options/models"), {
            headers: adminHeaders,
        });
        expect(res.ok()).toBeTruthy();

        const models = await res.json();
        expect(Array.isArray(models)).toBeTruthy();
        expect(models.length).toBe(4);
        expect(models[0].id).toContain("happyhorse-1.0");
    });

    test("POST /config/test with invalid key returns error", async ({ request }) => {
        const res = await request.post(consoleApi("/config/test"), {
            headers: adminHeaders,
            data: { apiKey: "invalid-key-12345" },
        });
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(body.success).toBe(false);
    });

    test("GET /config/health returns health status", async ({ request }) => {
        const res = await request.get(consoleApi("/generation/health"), {
            headers: adminHeaders,
        });
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(body.status).toBe("ok");
        expect(body.checkedAt).toBeDefined();
    });
});

// ──────────────────────────────────────────────
// Web User: Video Generation Flow
// ──────────────────────────────────────────────

test.describe("Web User: Video Generation", () => {
    test("GET /options/models returns 4 models", async ({ request }) => {
        const res = await request.get(webApi("/generation/options/models"));
        expect(res.ok()).toBeTruthy();

        const models = await res.json();
        expect(models).toHaveLength(4);
        const ids = models.map((m: { id: string }) => m.id);
        expect(ids).toContain("happyhorse-1.0-t2v");
        expect(ids).toContain("happyhorse-1.0-i2v");
        expect(ids).toContain("happyhorse-1.0-r2v");
        expect(ids).toContain("happyhorse-1.0-video-edit");
    });

    test("GET /options/provider-status returns status", async ({ request }) => {
        const res = await request.get(webApi("/generation/options/provider-status"));
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(typeof body.available).toBe("boolean");
        expect(typeof body.configured).toBe("boolean");
        expect(typeof body.enabled).toBe("boolean");
    });

    test("GET /options/templates returns templates array", async ({ request }) => {
        const res = await request.get(webApi("/generation/options/templates"));
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(Array.isArray(body.templates)).toBeTruthy();
    });

    test("POST /generation with empty prompt returns 400", async ({ request }) => {
        const res = await request.post(webApi("/generation"), {
            headers: userHeaders,
            data: { prompt: "", model: "happyhorse-1.0-t2v" },
        });
        expect(res.status()).toBe(400);
    });

    test("POST /generation with invalid model returns 400", async ({ request }) => {
        const res = await request.post(webApi("/generation"), {
            headers: userHeaders,
            data: { prompt: "test", model: "invalid-model" },
        });
        expect(res.status()).toBe(400);
    });

    test("POST /generation with T2V model and media returns 400", async ({ request }) => {
        const res = await request.post(webApi("/generation"), {
            headers: userHeaders,
            data: {
                prompt: "test video",
                model: "happyhorse-1.0-t2v",
                media: [{ type: "first_frame", url: "https://example.com/img.jpg" }],
            },
        });
        expect(res.status()).toBe(400);
    });

    test("POST /generation with SSRF URL returns 400", async ({ request }) => {
        const res = await request.post(webApi("/generation"), {
            headers: userHeaders,
            data: {
                prompt: "test video",
                model: "happyhorse-1.0-i2v",
                media: [{ type: "first_frame", url: "http://127.0.0.1/img.jpg" }],
            },
        });
        expect(res.status()).toBe(400);
    });

    test("GET /generation with pagination returns items", async ({ request }) => {
        const res = await request.get(webApi("/generation?page=1&pageSize=5"), {
            headers: userHeaders,
        });
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(body).toHaveProperty("items");
        expect(body).toHaveProperty("total");
        expect(Array.isArray(body.items)).toBeTruthy();
    });

    test("GET /generation/options/templates has correct structure", async ({ request }) => {
        const res = await request.get(webApi("/generation/options/templates"));
        const body = await res.json();
        expect(body.templates).toBeDefined();
        if (body.templates.length > 0) {
            expect(body.templates[0]).toHaveProperty("label");
            expect(body.templates[0]).toHaveProperty("prompt");
        }
    });
});

// ──────────────────────────────────────────────
// Admin: Batch Operations
// ──────────────────────────────────────────────

test.describe("Admin: Batch & History", () => {
    test("GET /generation returns admin history", async ({ request }) => {
        const res = await request.get(consoleApi("/generation?page=1&pageSize=10"), {
            headers: adminHeaders,
        });
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(body).toHaveProperty("items");
        expect(body).toHaveProperty("total");
    });

    test("POST /generation/batch/status returns summary", async ({ request }) => {
        const res = await request.post(consoleApi("/generation/batch/status"), {
            headers: adminHeaders,
            data: {},
        });
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(body).toHaveProperty("total");
        expect(body).toHaveProperty("succeeded");
        expect(body).toHaveProperty("failed");
        expect(body).toHaveProperty("stillProcessing");
    });

    test("POST /generation/batch/status with status filter", async ({ request }) => {
        const res = await request.post(consoleApi("/generation/batch/status"), {
            headers: adminHeaders,
            data: { status: "processing" },
        });
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(typeof body.total).toBe("number");
    });

    test("GET /generation/:id with invalid UUID returns 400", async ({ request }) => {
        const res = await request.get(consoleApi("/generation/not-a-uuid"), {
            headers: adminHeaders,
        });
        expect(res.status()).toBeGreaterThanOrEqual(400);
    });
});

// ──────────────────────────────────────────────
// Webhook Endpoint
// ──────────────────────────────────────────────

test.describe("Webhook", () => {
    test("POST /api/webhook/happyhorse without body returns 200", async ({ request }) => {
        const res = await request.post(webApi("/webhook/happyhorse"), {
            data: {},
        });
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(body.received).toBe(true);
    });

    test("POST /api/webhook/happyhorse with taskId returns 200", async ({ request }) => {
        const res = await request.post(webApi("/webhook/happyhorse"), {
            data: { task_id: "nonexistent-task-id", status: "failed" },
        });
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(body.received).toBe(true);
    });
});
