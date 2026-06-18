import { QueueModule, UploadModule } from "@buildingai/core/modules";
import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import { AccountLog, AiModel, File, StorageConfig } from "@buildingai/db/entities";
import { AiPublicModule, ExtensionBillingModule } from "@buildingai/extension-sdk";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { ContractGenerationConfig, ContractGenerationTask, ContractGenerationVersion, ContractTemplateEntity } from "../../db/entities";
import { ContractGenerationConsoleController } from "./controllers/console/contract-generation.controller";
import { ContractGenerationWebController } from "./controllers/web/contract-generation.web.controller";
import { ContractGenerationProcessor } from "./processors/contract-generation.processor";
import { ContractGenerationService } from "./services";
import { CONTRACT_GENERATION_QUEUE } from "./services/contract-queue.constants";

@Module({
    imports: [
        TypeOrmModule.forFeature([ContractGenerationTask, ContractGenerationConfig, ContractGenerationVersion, ContractTemplateEntity, AiModel, AccountLog, File, StorageConfig]),
        AiPublicModule,
        ExtensionBillingModule,
        UploadModule,
        QueueModule,
        BullModule.registerQueue({ name: CONTRACT_GENERATION_QUEUE }),
    ],
    controllers: [ContractGenerationWebController, ContractGenerationConsoleController],
    providers: [ContractGenerationService, ContractGenerationProcessor],
    exports: [ContractGenerationService],
})
export class ContractGenerationModule {}
