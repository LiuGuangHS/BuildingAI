import { BaseService } from "@buildingai/base";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import type { FindOptionsWhere } from "@buildingai/db/typeorm";
import { IsNull, Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { Injectable } from "@nestjs/common";

import { ImageGenerationMode } from "../../../db/entities/image-generation.entity";
import { ImageBillingRule } from "../../../db/entities/image-billing-rule.entity";
import { ImageModelConfig } from "../../../db/entities/image-model-config.entity";
import { CreateBillingRuleDto, EstimateBillingDto, QueryBillingRuleDto, UpdateBillingRuleDto } from "../dto";

type ImageBillingMultipliers = Record<string, number | string | undefined>;

@Injectable()
export class BillingRuleService extends BaseService<ImageBillingRule> {
    constructor(
        @InjectRepository(ImageBillingRule)
        private readonly billingRuleRepository: Repository<ImageBillingRule>,
        @InjectRepository(ImageModelConfig)
        private readonly modelConfigRepository: Repository<ImageModelConfig>,
    ) {
        super(billingRuleRepository);
    }

    async list(query: QueryBillingRuleDto) {
        return this.paginate(query, {
            where: query.modelConfigId
                ? ({ modelConfigId: query.modelConfigId } as FindOptionsWhere<ImageBillingRule>)
                : undefined,
            relations: ["modelConfig"],
            order: { createdAt: "DESC" },
        });
    }

    async createRule(dto: CreateBillingRuleDto) {
        await this.assertModelConfigExists(dto.modelConfigId);
        return this.billingRuleRepository.save(this.billingRuleRepository.create(this.normalizeRule(dto)));
    }

    async updateRule(id: string, dto: UpdateBillingRuleDto) {
        const rule = await this.findOneById(id);
        if (!rule) {
            throw HttpErrorFactory.notFound("计费规则不存在");
        }
        await this.assertModelConfigExists(dto.modelConfigId);
        Object.assign(rule, this.normalizeRule(dto, rule as ImageBillingRule));
        return this.billingRuleRepository.save(rule as ImageBillingRule);
    }

    async deleteRule(id: string) {
        await this.delete(id);
        return { success: true, message: "删除成功" };
    }

    async estimate(dto: EstimateBillingDto) {
        const amount = await this.calculateAmount(dto);
        return { amount };
    }

    async calculateAmount(dto: EstimateBillingDto): Promise<number> {
        const rule = await this.resolveRule(dto.modelConfigId);
        const count = Math.max(1, Number(dto.n ?? 1));
        const modeMultiplier =
            dto.mode === ImageGenerationMode.IMAGE_TO_IMAGE
                ? Number(rule.imageToImageMultiplier || 1)
                : Number(rule.textToImageMultiplier || 1);
        const qualityMultiplier = Number(rule.qualityMultipliers?.[dto.quality || "standard"] ?? 1);
        const sizeMultiplier = Number(rule.sizeMultipliers?.[dto.size || "1024x1024"] ?? this.defaultSizeMultiplier(dto.size));
        const countMultiplier = rule.countMultiplierEnabled ? count : 1;

        return normalizePowerAmount(
            Number(rule.baseCost || 1) *
                modeMultiplier *
                qualityMultiplier *
                sizeMultiplier *
                countMultiplier,
        );
    }

    async resolveRule(modelConfigId?: string) {
        const specific = modelConfigId
            ? await this.billingRuleRepository.findOne({
                where: { modelConfigId, enabled: true } as FindOptionsWhere<ImageBillingRule>,
                order: { createdAt: "DESC" },
            })
            : undefined;
        if (specific) return specific;

        const global = await this.billingRuleRepository.findOne({
            where: { modelConfigId: IsNull(), enabled: true } as FindOptionsWhere<ImageBillingRule>,
            order: { createdAt: "DESC" },
        });
        if (global) return global;

        return this.billingRuleRepository.create({
            baseCost: 1,
            textToImageMultiplier: 1,
            imageToImageMultiplier: 1.5,
            qualityMultipliers: { hd: 2, standard: 1 },
            sizeMultipliers: {},
            countMultiplierEnabled: true,
            refundOnFailure: true,
            enabled: true,
        });
    }

    private normalizeRule(dto: CreateBillingRuleDto | UpdateBillingRuleDto, existing?: ImageBillingRule) {
        const qualityMultipliers = this.normalizeMultipliers({
            hd: 2,
            standard: 1,
            ...(existing?.qualityMultipliers ?? {}),
            ...(dto.qualityMultipliers ?? {}),
        });
        const sizeMultipliers = this.normalizeMultipliers({
            ...(existing?.sizeMultipliers ?? {}),
            ...(dto.sizeMultipliers ?? {}),
        });

        return {
            ...dto,
            baseCost: dto.baseCost ?? existing?.baseCost ?? 1,
            textToImageMultiplier: dto.textToImageMultiplier ?? existing?.textToImageMultiplier ?? 1,
            imageToImageMultiplier: dto.imageToImageMultiplier ?? existing?.imageToImageMultiplier ?? 1.5,
            qualityMultipliers,
            sizeMultipliers,
            countMultiplierEnabled: dto.countMultiplierEnabled ?? existing?.countMultiplierEnabled ?? true,
            refundOnFailure: dto.refundOnFailure ?? existing?.refundOnFailure ?? true,
            enabled: dto.enabled ?? existing?.enabled ?? true,
        };
    }

    private normalizeMultipliers(value: ImageBillingMultipliers) {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => {
                const multiplier = Number(item);
                if (!Number.isFinite(multiplier) || multiplier < 0) {
                    throw HttpErrorFactory.badRequest("计费倍率必须是非负数字");
                }
                return [key, multiplier];
            }),
        );
    }

    private defaultSizeMultiplier(size?: string) {
        const [width, height] = (size ?? "1024x1024").split("x").map((item) => Number(item));
        return width > 1024 || height > 1024 ? 2 : 1;
    }

    private async assertModelConfigExists(modelConfigId?: string) {
        if (!modelConfigId) return;
        const exists = await this.modelConfigRepository.exists({
            where: { id: modelConfigId } as FindOptionsWhere<ImageModelConfig>,
        });
        if (!exists) {
            throw HttpErrorFactory.badRequest("计费规则引用的模型覆盖配置不存在");
        }
    }
}

export function normalizePowerAmount(value: number) {
    if (!Number.isFinite(value) || value < 0) {
        throw HttpErrorFactory.badRequest("计费金额必须是非负数字");
    }
    if (value === 0) return 0;
    return Math.ceil(value);
}
