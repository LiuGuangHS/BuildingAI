import { BaseService } from "@buildingai/base";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import type { FindOptionsWhere } from "@buildingai/db/typeorm";
import { IsNull, Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { Injectable } from "@nestjs/common";

import { ImageGenerationMode } from "../../../db/entities/image-generation.entity";
import { ImageModelConfig } from "../../../db/entities/image-model-config.entity";
import { ImagePolicyConfig, ImagePolicyScope } from "../../../db/entities/image-policy-config.entity";
import type { CreateGenerationDto } from "../../generation/dto";
import { UpsertPolicyDto } from "../dto";

@Injectable()
export class PolicyService extends BaseService<ImagePolicyConfig> {
    constructor(
        @InjectRepository(ImagePolicyConfig)
        private readonly policyRepository: Repository<ImagePolicyConfig>,
        @InjectRepository(ImageModelConfig)
        private readonly modelConfigRepository: Repository<ImageModelConfig>,
    ) {
        super(policyRepository);
    }

    async listPolicies() {
        return this.policyRepository.find({
            relations: ["modelConfig"],
            order: { scope: "ASC", createdAt: "DESC" },
        });
    }

    async upsertGlobal(dto: UpsertPolicyDto) {
        return this.upsertPolicy({ ...dto, scope: ImagePolicyScope.GLOBAL, modelConfigId: undefined });
    }

    async upsertModel(modelConfigId: string, dto: UpsertPolicyDto) {
        await this.assertModelConfigExists(modelConfigId);
        return this.upsertPolicy({ ...dto, scope: ImagePolicyScope.MODEL, modelConfigId });
    }

    async validateGeneration(modelConfigId: string | undefined, dto: CreateGenerationDto, activeCount = 0, todayCount = 0) {
        const policy = await this.resolvePolicy(modelConfigId);

        if (!policy.enabled) return policy;
        if (dto.prompt.length > policy.maxPromptLength) {
            throw HttpErrorFactory.badRequest(`提示词不能超过 ${policy.maxPromptLength} 字`);
        }
        if ((dto.negativePrompt?.length ?? 0) > policy.maxNegativePromptLength) {
            throw HttpErrorFactory.badRequest(`反向提示词不能超过 ${policy.maxNegativePromptLength} 字`);
        }
        if ((dto.n ?? 1) > policy.maxImagesPerRequest) {
            throw HttpErrorFactory.badRequest(`单次最多生成 ${policy.maxImagesPerRequest} 张图片`);
        }
        if (activeCount >= policy.maxConcurrentJobsPerUser) {
            throw HttpErrorFactory.badRequest("当前已有生成任务处理中，请稍后再试");
        }
        if (todayCount >= policy.dailyJobsPerUser) {
            throw HttpErrorFactory.badRequest("今日生成次数已达上限");
        }
        const sourceImages = this.collectSourceImages(dto);
        if (dto.referenceImageUrl && !policy.allowPublicUrlReference && !dto.referenceImageFileId && /^https?:\/\//i.test(dto.referenceImageUrl)) {
            throw HttpErrorFactory.badRequest("当前策略不允许使用外部参考图地址");
        }
        for (const item of sourceImages) {
            if (item.url && !policy.allowPublicUrlReference && !item.fileId && /^https?:\/\//i.test(item.url)) {
                throw HttpErrorFactory.badRequest("当前策略不允许使用外部参考图地址");
            }
        }
        if (dto.maskImageUrl && !policy.allowPublicUrlReference && !dto.maskImageFileId && /^https?:\/\//i.test(dto.maskImageUrl)) {
            throw HttpErrorFactory.badRequest("当前策略不允许使用外部遮罩图地址");
        }
        if ((dto.mode === ImageGenerationMode.IMAGE_TO_IMAGE || sourceImages.length > 0) && policy.maxReferenceImages < 1) {
            throw HttpErrorFactory.badRequest("当前策略不允许图生图");
        }
        if (sourceImages.length > policy.maxReferenceImages) {
            throw HttpErrorFactory.badRequest(`当前策略最多允许 ${policy.maxReferenceImages} 张参考图`);
        }

        return policy;
    }

    async resolvePolicy(modelConfigId?: string) {
        const global = await this.policyRepository.findOne({
            where: { scope: ImagePolicyScope.GLOBAL, enabled: true } as FindOptionsWhere<ImagePolicyConfig>,
            order: { createdAt: "DESC" },
        });
        const model = modelConfigId
            ? await this.policyRepository.findOne({
                where: { scope: ImagePolicyScope.MODEL, modelConfigId, enabled: true } as FindOptionsWhere<ImagePolicyConfig>,
                order: { createdAt: "DESC" },
            })
            : undefined;

        return this.policyRepository.create({
            ...this.defaultPolicy(),
            ...(global ?? {}),
            ...(model ?? {}),
            id: model?.id ?? global?.id,
        });
    }

    private async upsertPolicy(dto: UpsertPolicyDto) {
        const existing = await this.policyRepository.findOne({
            where: {
                scope: dto.scope,
                modelConfigId: dto.modelConfigId ?? IsNull(),
            } as FindOptionsWhere<ImagePolicyConfig>,
            order: { createdAt: "DESC" },
        });

        if (existing) {
            Object.assign(existing, dto);
            return this.policyRepository.save(existing);
        }

        return this.policyRepository.save(
            this.policyRepository.create({
                ...this.defaultPolicy(),
                ...dto,
            }),
        );
    }

    private defaultPolicy() {
        return {
            scope: ImagePolicyScope.GLOBAL,
            maxPromptLength: 4000,
            maxNegativePromptLength: 2000,
            maxImagesPerRequest: 4,
            maxReferenceImages: 1,
            maxReferenceImageSizeMb: 10,
            maxConcurrentJobsPerUser: 1,
            dailyJobsPerUser: 100,
            allowPublicUrlReference: false,
            enabled: true,
        };
    }

    private collectSourceImages(dto: CreateGenerationDto) {
        const images = [
            ...(dto.sourceImages ?? []),
            ...(dto.referenceImageUrl || dto.referenceImageFileId
                ? [{ url: dto.referenceImageUrl, fileId: dto.referenceImageFileId }]
                : []),
        ];
        const seen = new Set<string>();
        return images.filter((item) => {
            const key = item.fileId || item.url;
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    private async assertModelConfigExists(modelConfigId: string) {
        const exists = await this.modelConfigRepository.exists({
            where: { id: modelConfigId } as FindOptionsWhere<ImageModelConfig>,
        });
        if (!exists) {
            throw HttpErrorFactory.badRequest("风控策略引用的模型覆盖配置不存在");
        }
    }
}
