import { ACCOUNT_LOG_TYPE, ACTION } from "@buildingai/constants";
import { ACCOUNT_LOG_SOURCE } from "@buildingai/constants/shared/account-log.constants";
import { BaseBillingService } from "@buildingai/core/modules";
import {
    getExtensionIdentifierFromStack,
    getExtensionNameFromConfig,
    PowerDeductionOptions,
} from "@buildingai/core/modules";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { User } from "@buildingai/db/entities";
import { AccountLog } from "@buildingai/db/entities";
import { EntityManager, Repository } from "@buildingai/db/typeorm";
import { Injectable, Logger } from "@nestjs/common";

export interface ExtensionPowerDeductionOptions extends Omit<
    PowerDeductionOptions,
    "source" | "accountType"
> {}

export interface ExtensionBillingLogExistsOptions {
    associationNo: string;
    action: (typeof ACTION)[keyof typeof ACTION];
    accountType?: (typeof ACCOUNT_LOG_TYPE)[keyof typeof ACCOUNT_LOG_TYPE];
}

/**
 * Extension Billing Service
 */
@Injectable()
export class ExtensionBillingService {
    protected readonly logger = new Logger(ExtensionBillingService.name);
    private readonly baseBillingService: BaseBillingService;

    /**
     * Add extension-specific billing methods here
     *
     * For example:
     * - Plugin usage tracking
     * - Extension-specific pricing rules
     * - Third-party API cost calculations
     */

    constructor(
        @InjectRepository(User)
        protected readonly userRepository: Repository<User>,
        @InjectRepository(AccountLog)
        protected readonly accountLogRepository: Repository<AccountLog>,
    ) {
        this.baseBillingService = new BaseBillingService(userRepository, accountLogRepository);
    }

    /**
     * Check if user has sufficient power
     *
     * @param userId - User ID
     * @param requiredAmount - Required power amount
     * @returns true if user has sufficient power
     */
    async hasSufficientPower(userId: string, requiredAmount: number) {
        return this.baseBillingService.hasSufficientPower(userId, requiredAmount);
    }

    /**
     * Check whether a plugin billing log already exists for an association.
     *
     * Use this before refunding or retrying a plugin task so extensions can rely
     * on the main billing ledger as the source of truth instead of querying
     * account logs directly.
     */
    async hasBillingLog(opts: ExtensionBillingLogExistsOptions, entityManager?: EntityManager) {
        const repository = entityManager?.getRepository(AccountLog) ?? this.accountLogRepository;
        return repository.exists({
            where: {
                associationNo: opts.associationNo,
                accountType: opts.accountType ?? ACCOUNT_LOG_TYPE.PLUGIN_DEC,
                action: opts.action,
            },
        });
    }

    /**
     * Deduct user power
     *
     * @param opts - Power deduction options
     * @param entityManager - Optional entity manager
     */
    async deductUserPower(opts: ExtensionPowerDeductionOptions, entityManager?: EntityManager) {
        const extensionIdentifier = getExtensionIdentifierFromStack(["/build/modules/", "/src/api/modules/"]);

        if (!extensionIdentifier) {
            throw new Error("Extension not found");
        }

        const extensionName = (await getExtensionNameFromConfig(extensionIdentifier)) || "unknown";

        return await this.baseBillingService.deductUserPower(
            {
                userId: opts.userId,
                amount: opts.amount,
                accountType: ACCOUNT_LOG_TYPE.PLUGIN_DEC,
                source: {
                    type: ACCOUNT_LOG_SOURCE.PLUGIN,
                    source: extensionName,
                },
                remark: opts.remark,
                associationNo: opts.associationNo,
                associationUserId: opts.associationUserId,
            },
            entityManager,
        );
    }

    /**
     * Add user power
     *
     * @param opts - Power addition options
     * @param entityManager - Optional entity manager
     */
    async addUserPower(opts: ExtensionPowerDeductionOptions, entityManager?: EntityManager) {
        const extensionIdentifier = getExtensionIdentifierFromStack(["/build/modules/", "/src/api/modules/"]);

        if (!extensionIdentifier) {
            throw new Error("Extension not found");
        }

        const extensionName = (await getExtensionNameFromConfig(extensionIdentifier)) || "unknown";

        return await this.baseBillingService.addUserPower(
            {
                userId: opts.userId,
                amount: opts.amount,
                accountType: ACCOUNT_LOG_TYPE.PLUGIN_DEC,
                source: {
                    type: ACCOUNT_LOG_SOURCE.PLUGIN,
                    source: extensionName,
                },
                remark: opts.remark,
                associationNo: opts.associationNo,
                associationUserId: opts.associationUserId,
            },
            entityManager,
        );
    }
}
