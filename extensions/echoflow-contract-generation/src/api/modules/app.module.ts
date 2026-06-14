import { Module } from "@nestjs/common";

import { ContractGenerationModule } from "./contract-generation/contract-generation.module";

@Module({
    imports: [ContractGenerationModule],
    exports: [ContractGenerationModule],
})
export class AppModule {}
