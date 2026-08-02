jest.mock("@buildingai/cache", () => ({ CacheService: class CacheService {} }));
jest.mock("@buildingai/db/entities/ai-agent.entity", () => ({ Agent: class Agent {} }));
jest.mock("@buildingai/db/entities/datasets.entity", () => ({
  Datasets: class Datasets {},
  SquarePublishStatus: { APPROVED: "approved" },
}));
jest.mock("@buildingai/db/entities/extension.entity", () => ({ Extension: class Extension {} }));
jest.mock("@buildingai/db/@nestjs/typeorm", () => ({ InjectRepository: () => () => undefined }));
jest.mock("@buildingai/db/typeorm", () => ({}));
jest.mock("@buildingai/decorators/public.decorator", () => ({ Public: () => () => undefined }));

import { SitemapController } from "./sitemap.controller";

function createController(identifier = "safe") {
  return new SitemapController(
    { find: jest.fn().mockResolvedValue([]) } as never,
    { find: jest.fn().mockResolvedValue([{ identifier, updatedAt: null }]) } as never,
    { find: jest.fn().mockResolvedValue([]) } as never,
    { get: jest.fn().mockResolvedValue(null), set: jest.fn() } as never,
  );
}

describe("SitemapController", () => {
  const originalDomain = process.env.APP_DOMAIN;

  afterEach(() => {
    if (originalDomain === undefined) {
      delete process.env.APP_DOMAIN;
    } else {
      process.env.APP_DOMAIN = originalDomain;
    }
  });

  it("requires an explicit public site domain", async () => {
    delete process.env.APP_DOMAIN;

    await expect(createController().generateSitemap()).rejects.toThrow(
      "APP_DOMAIN is required to generate sitemap.xml",
    );
  });

  it("escapes dynamic extension identifiers in sitemap URLs", async () => {
    process.env.APP_DOMAIN = "https://ai.echoflow.cn";

    await expect(createController("image&preview").generateSitemap()).resolves.toContain(
      "https://ai.echoflow.cn/apps/image&amp;preview",
    );
  });
});
