import { CacheService } from "@buildingai/cache";
import { Agent, Datasets, Extension } from "@buildingai/db/entities";
import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import { Module } from "@nestjs/common";

import { SitemapController } from "./sitemap.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Agent, Extension, Datasets])],
  controllers: [SitemapController],
  providers: [CacheService],
})
export class SitemapModule {}