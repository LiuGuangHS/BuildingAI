import { SecretService, UploadModule } from "@buildingai/core/modules";
import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import { AccountLog, AiModel, AiProvider, File, Secret, SecretTemplate, StorageConfig, User } from "@buildingai/db/entities";
import { ExtensionBillingModule, PublicAiModelService } from "@buildingai/extension-sdk";
import { Module } from "@nestjs/common";

import { ContractGenerationConfig, ContractGenerationTask, ContractGenerationVersion, ContractTemplateEntity } from "../../db/entities";
import { ContractGenerationConsoleController } from "./controllers/console/contract-generation.controller";
import { ContractGenerationWebController } from "./controllers/web/contract-generation.web.controller";
import { ContractGenerationService } from "./services";

@Module({
    imports: [TypeOrmModule.forFeature([ContractGenerationTask, ContractGenerationConfig, ContractGenerationVersion, ContractTemplateEntity, AiModel, AiProvider, User, AccountLog, File, StorageConfig, Secret, SecretTemplate]), ExtensionBillingModule, UploadModule],
    controllers: [ContractGenerationWebController, ContractGenerationConsoleController],
    providers: [ContractGenerationService, PublicAiModelService, SecretService],
    exports: [ContractGenerationService],
})
export class ContractGenerationModule {}
