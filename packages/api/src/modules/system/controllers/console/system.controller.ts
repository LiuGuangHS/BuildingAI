import { BuildFileUrl } from "@buildingai/decorators/file-url.decorator";
import { Public } from "@buildingai/decorators/public.decorator";
import { ConsoleController } from "@common/decorators";
import { initializeDto } from "@modules/system/dto/system.dto";
import { Body, Delete, Get, Ip, Logger, Param, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { Permissions } from "src/common/decorators/permissions.decorator";

import { SystemService } from "../../services/system.service";
import { BackupService } from "../../services/backup.service";

/**
 * 系统控制器
 *
 * 提供系统级操作的接口，如重启应用
 */
@ConsoleController("system", "系统")
export class SystemConsoleController {
    private readonly logger = new Logger(SystemConsoleController.name);

    constructor(
        private readonly systemService: SystemService,
        private readonly backupService: BackupService,
    ) {}

    @Public()
    @Get("initialize")
    @BuildFileUrl(["user.avatar"])
    async getSystemInfo() {
        return this.systemService.getSystemInfo();
    }

    /**
     * 系统运行信息（版本号 & 系统ID）
     * 用于控制台“系统信息”弹窗展示
     */
    @Get("runtime")
    async getRuntimeInfo() {
        return this.systemService.getRuntimeInfo();
    }

    @Public()
    @Post("initialize")
    @BuildFileUrl(["user.avatar"])
    async setSystemInfo(
        @Body() dto: initializeDto,
        @Ip() ipAddress: string,
        @Req() request: Request,
    ) {
        const userAgent = request.get("user-agent");
        return this.systemService.initialize(dto, ipAddress, userAgent);
    }

    /**
     * 重启应用
     *
     * 通过PM2自动重启机制实现可靠的应用重启
     */
    @Post("restart")
    @Permissions({
        code: "restart",
        name: "重启应用",
        hidden: true,
    })
    async restartApplication() {
        return this.systemService.restartApplication();
    }

    @Get("backup/config")
    @Permissions({
        code: "backup:list",
        name: "查看备份配置",
    })
    async getBackupConfig() {
        return this.backupService.getConfig();
    }

    @Post("backup/config")
    @Permissions({
        code: "backup:config",
        name: "更新备份配置",
    })
    async updateBackupConfig(@Body() dto: { enabled?: boolean; retentionDays?: number }) {
        return this.backupService.updateConfig(dto);
    }

    @Get("backups")
    @Permissions({
        code: "backup:list",
        name: "查看备份列表",
    })
    async listBackups() {
        return this.backupService.listBackups();
    }

    @Post("backups")
    @Permissions({
        code: "backup:create",
        name: "创建备份",
    })
    async createBackup() {
        return this.backupService.createBackup();
    }

    @Delete("backups/:filename")
    @Permissions({
        code: "backup:delete",
        name: "删除备份",
    })
    async deleteBackup(@Param("filename") filename: string) {
        await this.backupService.deleteBackup(filename);
        return { success: true };
    }
}
