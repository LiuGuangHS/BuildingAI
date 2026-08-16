import { CacheService } from "@buildingai/cache";
import { Agent, Datasets, Extension } from "@buildingai/db/entities";
import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import { Module } from "@nestjs/common";

import { SystemModule } from "../system/system.module";
import { ManifestController } from "./manifest.controller";
import { SitemapController } from "./sitemap.controller";
@Module({
  imports: [SystemModule, TypeOrmModule.forFeature([Agent, Extension, Datasets])],
  controllers: [SitemapController, ManifestController],
  providers: [CacheService],
})
export class SitemapModule {}