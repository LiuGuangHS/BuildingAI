import { Module } from "@nestjs/common";

import { GenerationModule } from "./generation/generation.module";

@Module({
    imports: [GenerationModule],
    exports: [GenerationModule],
})
export class AppModule {}
