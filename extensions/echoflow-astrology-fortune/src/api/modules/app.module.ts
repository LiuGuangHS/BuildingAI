import { Module } from "@nestjs/common";

import { AstrologyFortuneModule } from "./astrology-fortune/astrology-fortune.module";

@Module({
    imports: [AstrologyFortuneModule],
    exports: [AstrologyFortuneModule],
})
export class AppModule {}
