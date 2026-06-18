import { QueueModule } from "@buildingai/core/modules";
import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import { AccountLog, AiModel } from "@buildingai/db/entities";
import { AiPublicModule, ExtensionBillingModule } from "@buildingai/extension-sdk";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { AstrologyFortuneSetting, AstrologyProfile, AstrologyReport } from "../../db/entities";
import { AstrologyFortuneConsoleController } from "./controllers/console/astrology-fortune.controller";
import { AstrologyFortuneWebController } from "./controllers/web/astrology-fortune.web.controller";
import { AstrologyReportProcessor } from "./processors/astrology-report.processor";
import { AstrologyFortuneService } from "./services";
import { ASTROLOGY_REPORT_QUEUE } from "./services/astrology-queue.constants";

@Module({
    imports: [
        TypeOrmModule.forFeature([AstrologyFortuneSetting, AstrologyProfile, AstrologyReport, AiModel, AccountLog]),
        AiPublicModule,
        ExtensionBillingModule,
        QueueModule,
        BullModule.registerQueue({ name: ASTROLOGY_REPORT_QUEUE }),
    ],
    controllers: [AstrologyFortuneWebController, AstrologyFortuneConsoleController],
    providers: [AstrologyFortuneService, AstrologyReportProcessor],
    exports: [AstrologyFortuneService],
})
export class AstrologyFortuneModule {}
