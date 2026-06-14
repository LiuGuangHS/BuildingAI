import { SecretService } from "@buildingai/core/modules";
import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import { AccountLog, AiModel, AiProvider, Secret, SecretTemplate, User } from "@buildingai/db/entities";
import { ExtensionBillingModule, PublicAiModelService } from "@buildingai/extension-sdk";
import { Module } from "@nestjs/common";

import { AstrologyFortuneSetting, AstrologyProfile, AstrologyReport } from "../../db/entities";
import { AstrologyFortuneConsoleController } from "./controllers/console/astrology-fortune.controller";
import { AstrologyFortuneWebController } from "./controllers/web/astrology-fortune.web.controller";
import { AstrologyFortuneService } from "./services";

@Module({
    imports: [TypeOrmModule.forFeature([AstrologyFortuneSetting, AstrologyProfile, AstrologyReport, AiModel, AiProvider, Secret, SecretTemplate, User, AccountLog]), ExtensionBillingModule],
    controllers: [AstrologyFortuneWebController, AstrologyFortuneConsoleController],
    providers: [AstrologyFortuneService, PublicAiModelService, SecretService],
    exports: [AstrologyFortuneService],
})
export class AstrologyFortuneModule {}
