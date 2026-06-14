import { Module } from "@nestjs/common";

import { TownModule } from "./town/town.module";

@Module({
    imports: [TownModule],
    exports: [TownModule],
})
export class AppModule {}
