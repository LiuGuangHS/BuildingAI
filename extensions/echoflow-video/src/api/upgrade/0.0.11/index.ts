import type { DataSource } from "@buildingai/db/typeorm";
import { Logger } from "@nestjs/common";

export class Upgrade {
    private readonly logger = new Logger(Upgrade.name);

    constructor(private readonly dataSource: DataSource) {}

    async execute(): Promise<void> {
        await this.dataSource.query(
            `
                UPDATE "extension"
                SET "version" = $1, "updated_at" = now()
                WHERE "identifier" = $2
            `,
            ["0.0.11", "echoflow-video"],
        );
        this.logger.log("Echoflow Video upgrade to version 0.0.11 completed");
    }
}
