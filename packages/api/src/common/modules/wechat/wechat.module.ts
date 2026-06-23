import { AuthModule } from "@modules/auth/auth.module";
import { ChannelModule } from "@modules/channel/channel.module";
import { Module } from "@nestjs/common";

import { WechatOaService } from "./services/wechatoa.service";

@Module({
    imports: [ChannelModule, AuthModule],
    providers: [WechatOaService],
    exports: [WechatOaService],
})
export class WechatModule {}
