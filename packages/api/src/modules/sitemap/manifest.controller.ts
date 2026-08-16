import { Public } from "@buildingai/decorators/public.decorator";
import { Controller, Get, Header } from "@nestjs/common";

import { WebsiteService } from "../system/services/website.service";

@Controller()
export class ManifestController {
    constructor(private readonly websiteService: WebsiteService) {}

    @Get("manifest.webmanifest")
    @Public()
    @Header("Content-Type", "application/manifest+json")
    async getManifest() {
        const { webinfo } = await this.websiteService.getConfig();
        const name = webinfo.name || "EchoFlowAI";

        return {
            name,
            short_name: name,
            description: webinfo.description || name,
            id: "/",
            start_url: "/",
            scope: "/",
            display: "standalone",
            orientation: "any",
            background_color: "#ffffff",
            theme_color: "#4f46e5",
            icons: [
                {
                    src: webinfo.icon || "/pwa-192x192.png",
                    sizes: "192x192",
                    type: "image/png",
                    purpose: "any",
                },
                {
                    src: "/pwa-512x512.png",
                    sizes: "512x512",
                    type: "image/png",
                    purpose: "any maskable",
                },
            ],
            categories: ["productivity", "utilities"],
            lang: "zh-CN",
        };
    }
}
