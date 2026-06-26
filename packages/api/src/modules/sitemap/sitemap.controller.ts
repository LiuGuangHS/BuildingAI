import { CacheService } from "@buildingai/cache";
import { Agent } from "@buildingai/db/entities/ai-agent.entity";
import { Datasets, SquarePublishStatus } from "@buildingai/db/entities/datasets.entity";
import { Extension } from "@buildingai/db/entities/extension.entity";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { Public } from "@buildingai/decorators/public.decorator";
import { Controller, Get, Header } from "@nestjs/common";
import { Repository } from "@buildingai/db/typeorm";

const BASE_URL = "https://ai.echoflow.cn";
const CACHE_KEY = "sitemap_xml";
const CACHE_TTL = 3600; // 1 hour in seconds

@Controller()
export class SitemapController {
  constructor(
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
    @InjectRepository(Extension)
    private readonly extensionRepo: Repository<Extension>,
    @InjectRepository(Datasets)
    private readonly datasetRepo: Repository<Datasets>,
    private readonly cacheService: CacheService,
  ) {}

  @Get("sitemap.xml")
  @Public()
  @Header("Content-Type", "application/xml")
  async generateSitemap(): Promise<string> {
    const cached = await this.cacheService.get<string>(CACHE_KEY);
    if (cached) return cached;

    const urls: string[] = [];

    urls.push(this.urlEntry("/", "1.0"));
    urls.push(this.urlEntry("/agents", "0.9"));
    urls.push(this.urlEntry("/datasets", "0.8"));
    urls.push(this.urlEntry("/apps", "0.8"));

    const agents = await this.agentRepo.find({
      where: {
        squarePublishStatus: SquarePublishStatus.APPROVED,
        publishedToSquare: true,
      },
      select: ["id", "updatedAt"],
    });
    for (const agent of agents) {
      urls.push(this.urlEntry(`/agents/${agent.id}/chat`, "0.8", agent.updatedAt));
    }

    const extensions = await this.extensionRepo.find({
      where: { status: 1 },
      select: ["identifier", "updatedAt"],
    });
    for (const ext of extensions) {
      urls.push(this.urlEntry(`/apps/${ext.identifier}`, "0.7", ext.updatedAt));
    }

    const datasets = await this.datasetRepo.find({
      where: { squarePublishStatus: SquarePublishStatus.APPROVED },
      select: ["id", "updatedAt"],
    });
    for (const ds of datasets) {
      urls.push(this.urlEntry(`/datasets/${ds.id}`, "0.7", ds.updatedAt));
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

    await this.cacheService.set(CACHE_KEY, xml, CACHE_TTL);
    return xml;
  }

  private urlEntry(loc: string, priority: string, lastmod?: Date | null): string {
    const lastmodStr = lastmod
      ? `\n    <lastmod>${lastmod.toISOString().split("T")[0]}</lastmod>`
      : "";
    return `  <url>
    <loc>${BASE_URL}${loc}</loc>
    <priority>${priority}</priority>${lastmodStr}
  </url>`;
  }
}