jest.mock("../system/services/website.service", () => ({ WebsiteService: class {} }));

import { ManifestController } from "./manifest.controller";
import type { WebsiteService } from "../system/services/website.service";

describe("PWA manifest boundary", () => {
    it("builds a manifest from the configured website values", async () => {
        const websiteService = {
            getConfig: jest.fn().mockResolvedValue({
                webinfo: {
                    name: "清云AI",
                    description: "AI workspace",
                    icon: "/brand.png",
                },
            }),
        } as unknown as WebsiteService;
        const controller = new ManifestController(websiteService);

        await expect(controller.getManifest()).resolves.toMatchObject({
            name: "清云AI",
            short_name: "清云AI",
            description: "AI workspace",
            start_url: "/",
            icons: expect.arrayContaining([
                expect.objectContaining({ src: "/brand.png", sizes: "192x192" }),
                expect.objectContaining({ src: "/pwa-512x512.png", purpose: "any maskable" }),
            ]),
        });
        expect(websiteService.getConfig).toHaveBeenCalledTimes(1);
    });

    it("uses stable defaults when website values are empty", async () => {
        const websiteService = {
            getConfig: jest.fn().mockResolvedValue({ webinfo: {} }),
        } as unknown as WebsiteService;
        const controller = new ManifestController(websiteService);

        await expect(controller.getManifest()).resolves.toMatchObject({
            name: "EchoFlowAI",
            short_name: "EchoFlowAI",
            description: "EchoFlowAI",
            icons: expect.arrayContaining([
                expect.objectContaining({ src: "/pwa-192x192.png" }),
            ]),
        });
    });
});
