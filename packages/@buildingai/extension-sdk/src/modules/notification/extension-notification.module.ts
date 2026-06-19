import { Global, Module } from "@nestjs/common";

import { ExtensionNotificationService } from "./extension-notification.service";

@Global()
@Module({
    providers: [ExtensionNotificationService],
    exports: [ExtensionNotificationService],
})
export class ExtensionNotificationModule {}
