import { BaseService } from "@buildingai/base";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import type { FindOptionsWhere } from "@buildingai/db/typeorm";
import { IsNull, Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { Injectable } from "@nestjs/common";

import { HappyHorseModel } from "../../../db/entities/video-generation.entity";
import { VideoBillingRule } from "../../../db/entities/video-billing-rule.entity";
import {
    EstimateVideoBillingDto,
    QueryVideoBillingRuleDto,
    SaveVideoBillingRuleDto,
} from "../dto";

@Injectable()
export class BillingRuleService extends BaseService<VideoBillingRule> {
    constructor(
        @InjectRepository(VideoBillingRule)
        private readonly billingRuleRepository: Repository<VideoBillingRule>,
    ) {
        super(billingRuleRepository);
    }

    async list(query: QueryVideoBillingRuleDto) {
        return this.paginate(query, {
            where: query.modelConfigId
                ? ({ modelConfigId: query.modelConfigId } as FindOptionsWhere<VideoBillingRule>)
                : undefined,
            relations: ["modelConfig"],
            order: { createdAt: "DESC" },
        });
    }

    async createRule(dto: SaveVideoBillingRuleDto) {
        return this.billingRuleRepository.save(
            this.billingRuleRepository.create(this.normalizeRule(dto)),
        );
    }

    async updateRule(id: string, dto: SaveVideoBillingRuleDto) {
        const rule = await this.findOneById(id);
        if (!rule) {
            throw HttpErrorFactory.notFound("视频计费规则不存在");
        }
        Object.assign(rule, this.normalizeRule(dto, rule as VideoBillingRule));
        return this.billingRuleRepository.save(rule as VideoBillingRule);
    }

    async deleteRule(id: string) {
        await this.delete(id);
        return { success: true, message: "删除成功" };
    }

    async estimate(dto: EstimateVideoBillingDto) {
        const amount = await this.calculateAmount(dto);
        return { amount };
    }

    async calculateAmount(dto: EstimateVideoBillingDto): Promise<number> {
        const rule = await this.resolveRule(dto.modelConfigId, dto.model);
        const duration = Math.max(1, Number(dto.duration ?? 5));
        const resolutionMultiplier = Number(
            rule.resolutionMultipliers?.[dto.resolution || "720P"] ??
            (dto.resolution === "1080P" ? 2 : 1),
        );
        const amount = Number(rule.baseCost || 0) + Number(rule.perSecondCost || 1) * duration * resolutionMultiplier;
        return Math.max(Number(rule.minimumCost || 0), roundPower(amount));
    }

    async resolveRule(modelConfigId?: string, model?: string) {
        if (modelConfigId) {
            const specific = await this.billingRuleRepository.findOne({
                where: { modelConfigId, enabled: true } as FindOptionsWhere<VideoBillingRule>,
                order: { createdAt: "DESC" },
            });
            if (specific) return specific;
        }

        const global = await this.billingRuleRepository.findOne({
            where: { modelConfigId: IsNull(), enabled: true } as FindOptionsWhere<VideoBillingRule>,
            order: { createdAt: "DESC" },
        });
        if (global) return global;

        return this.billingRuleRepository.create({
            baseCost: 0,
            perSecondCost: this.defaultPerSecondCost(model),
            resolutionMultipliers: { "720P": 1, "1080P": 2 },
            minimumCost: 1,
            refundOnFailure: true,
            enabled: true,
        });
    }

    private normalizeRule(dto: SaveVideoBillingRuleDto, existing?: VideoBillingRule) {
        return {
            ...dto,
            baseCost: dto.baseCost ?? existing?.baseCost ?? 0,
            perSecondCost: dto.perSecondCost ?? existing?.perSecondCost ?? 2,
            resolutionMultipliers: {
                "720P": 1,
                "1080P": 2,
                ...(existing?.resolutionMultipliers ?? {}),
                ...(dto.resolutionMultipliers ?? {}),
            },
            minimumCost: dto.minimumCost ?? existing?.minimumCost ?? 1,
            refundOnFailure: dto.refundOnFailure ?? existing?.refundOnFailure ?? true,
            enabled: dto.enabled ?? existing?.enabled ?? true,
        };
    }

    private defaultPerSecondCost(model?: string) {
        const modelMultiplier: Record<string, number> = {
            [HappyHorseModel.T2V]: 2,
            [HappyHorseModel.I2V]: 3,
            [HappyHorseModel.R2V]: 3,
            [HappyHorseModel.VIDEO_EDIT]: 4,
        };
        return model ? modelMultiplier[model] ?? 2 : 2;
    }
}

function roundPower(value: number) {
    return Math.ceil(value * 100) / 100;
}
