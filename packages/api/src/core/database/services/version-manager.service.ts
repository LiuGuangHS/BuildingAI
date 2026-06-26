import { DataSource } from "@buildingai/db/typeorm";
import { TerminalLogger } from "@buildingai/logger";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import fse from "fs-extra";
import * as path from "path";

import { MigrationRunner } from "../upgrade/migration-runner";
import { UpgradeService } from "../upgrade/upgrade.service";
import { VersionDetector, VersionInfo } from "../upgrade/version-detector";

/**
 * Version manager service
 *
 * Responsible for:
 * 1. Detecting version changes
 * 2. Coordinating migration execution
 * 3. Coordinating upgrade script execution
 * 4. Managing version files
 */
@Injectable()
export class VersionManagerService implements OnModuleInit {
    private readonly logger = new Logger(VersionManagerService.name);
    private readonly versionDetector: VersionDetector;
    private readonly migrationRunner: MigrationRunner;

    constructor(
        private readonly dataSource: DataSource,
        private readonly upgradeService: UpgradeService,
    ) {
        this.versionDetector = new VersionDetector();
        this.migrationRunner = new MigrationRunner(dataSource);
    }

    /**
     * Executed automatically during module initialization
     *
     * Checks version and performs upgrade if needed
     */
    async onModuleInit() {
        // Version check is handled by DatabaseInitService
        // This service only provides upgrade capabilities
    }

    /**
     * Check version and execute upgrade if needed
     */
    async checkAndUpgrade(): Promise<void> {
        try {
            const versionInfo = await this.versionDetector.detect();

            if (!versionInfo.needsUpgrade) {
                this.logger.log(`✅ Version is up to date: ${versionInfo.current}`);
                return;
            }

            this.logger.log(
                `⚠️ Version upgrade needed: ${versionInfo.installed || "initial"} -> ${versionInfo.current}`,
            );
            TerminalLogger.warn(
                "Version Check",
                `Upgrade needed: ${versionInfo.installed || "initial"} -> ${versionInfo.current}`,
                { icon: "ℹ" },
            );

            await this.executeUpgrade(versionInfo);
        } catch (error) {
            this.logger.error(`❌ Version check and upgrade failed: ${error.message}`);
            TerminalLogger.error("Version Check", `Failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Execute upgrade process
     *
     * Upgrades are executed version by version:
     * For each version: migration → upgrade script → write version file
     * This ensures that if upgrade fails, we can resume from the failed version
     */
    private async executeUpgrade(versionInfo: VersionInfo): Promise<void> {
        try {
            this.logger.log("🚀 Starting upgrade process...");
            this.logger.log(`📋 Upgrade path: ${versionInfo.upgradeVersions.join(" → ")}`);
            TerminalLogger.log("System Upgrade", "Starting upgrade process...");

            // Execute upgrade for each version sequentially
            for (const version of versionInfo.upgradeVersions) {
                await this.executeVersionUpgrade(version);
            }

            this.logger.log(`✅ Upgrade completed: ${versionInfo.current}`);
            TerminalLogger.success("System Upgrade", `Completed: ${versionInfo.current}`);
        } catch (error) {
            this.logger.error(`❌ Upgrade failed: ${error.message}`);
            TerminalLogger.error("System Upgrade", `Failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Execute upgrade for a single version
     *
     * Steps:
     * 1. Execute database migrations for this version
     * 2. Execute upgrade script for this version
     * 3. Write version file to mark completion
     */
    private async executeVersionUpgrade(version: string): Promise<void> {
        try {
            this.logger.log(`\n${"=".repeat(60)}`);
            this.logger.log(`🔄 Upgrading to version: ${version}`);
            this.logger.log(`${"=".repeat(60)}`);
            TerminalLogger.log("Version Upgrade", `Upgrading to ${version}...`);

            // Step 1: Execute database migrations for this version
            await this.executeMigrationForVersion(version);

            // Step 2: Execute upgrade script for this version
            await this.executeUpgradeScriptForVersion(version);

            // Step 3: Write version file to mark this version as completed
            await this.writeVersionFile(version);

            this.logger.log(`✅ Version ${version} upgrade completed`);
            TerminalLogger.success("Version Upgrade", `${version} completed`);
        } catch (error) {
            this.logger.error(`❌ Version ${version} upgrade failed: ${error.message}`);
            TerminalLogger.error("Version Upgrade", `${version} failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Execute database migration for a single version
     */
    private async executeMigrationForVersion(version: string): Promise<void> {
        try {
            this.logger.log(`📦 Executing database migrations for ${version}...`);

            await this.migrationRunner.runCrossVersionMigrations([version]);

            this.logger.log(`✅ Database migrations for ${version} completed`);
        } catch (error) {
            this.logger.error(`❌ Database migrations for ${version} failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Execute upgrade script for a single version
     */
    private async executeUpgradeScriptForVersion(version: string): Promise<void> {
        try {
            this.logger.log(`🔧 Executing upgrade script for ${version}...`);

            // Create upgrade context with necessary services
            const context = this.upgradeService.createContext({
                // Add any additional services needed by upgrade scripts
            });

            await this.upgradeService.executeUpgradeScripts([version], context);

            this.logger.log(`✅ Upgrade script for ${version} completed`);
        } catch (error) {
            this.logger.error(`❌ Upgrade script for ${version} failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Write version file
     */
    private async writeVersionFile(version: string): Promise<void> {
        const versionsDir = this.versionDetector.getVersionsDir();
        const versionFilePath = path.join(versionsDir, version);

        await fse.mkdirp(versionsDir);
        await fse.writeFile(
            versionFilePath,
            JSON.stringify(
                {
                    version: version,
                    upgraded_at: new Date().toISOString(),
                    description: `System upgraded to version ${version}`,
                },
                null,
                2,
            ),
        );

        this.logger.log(`Version file written: ${version}`);
    }

    /**
     * Get current version info
     */
    async getVersionInfo(): Promise<VersionInfo> {
        return this.versionDetector.detect();
    }

    /**
     * Get current version
     */
    async getCurrentVersion(): Promise<string> {
        return this.versionDetector.getCurrentVersion();
    }

    /**
     * Get installed version
     */
    async getInstalledVersion(): Promise<string | null> {
        return this.versionDetector.getInstalledVersion();
    }
}
