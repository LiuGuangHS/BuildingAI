import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import { Module } from "@nestjs/common";

import { ImagePromptTemplate } from "../../db/entities/image-prompt-template.entity";
import { TemplateController } from "./controllers/console/template.controller";
import { TemplateWebController } from "./controllers/web/template.web.controller";
import { TemplateService } from "./services/template.service";

@Module({
    imports: [TypeOrmModule.forFeature([ImagePromptTemplate])],
    controllers: [TemplateController, TemplateWebController],
    providers: [TemplateService],
    exports: [TemplateService],
})
export class TemplateModule {}
