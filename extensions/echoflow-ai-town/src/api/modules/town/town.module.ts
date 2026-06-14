import { SecretService } from "@buildingai/core/modules";
import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import { AiModel, AiProvider, Secret, SecretTemplate } from "@buildingai/db/entities";
import { PublicAiModelService } from "@buildingai/extension-sdk";
import { Module } from "@nestjs/common";

import { TownAiCallLog, TownAiConfig, TownCharacter, TownEvent, TownSave } from "../../db/entities";
import { TownConsoleController } from "./controllers/console/town.controller";
import { TownWebController } from "./controllers/web/town.web.controller";
import { TownAiService } from "./services/town-ai.service";
import { TownProgressRulesService } from "./services/town-progress-rules.service";
import { TownRelationshipRulesService } from "./services/town-relationship-rules.service";
import { TownService } from "./services/town.service";
import { TownWorldRulesService } from "./services/town-world-rules.service";

@Module({
    imports: [TypeOrmModule.forFeature([TownSave, TownCharacter, TownEvent, TownAiConfig, TownAiCallLog, AiModel, AiProvider, Secret, SecretTemplate])],
    controllers: [TownWebController, TownConsoleController],
    providers: [TownService, TownAiService, TownWorldRulesService, TownRelationshipRulesService, TownProgressRulesService, PublicAiModelService, SecretService],
    exports: [TownService],
})
export class TownModule {}
