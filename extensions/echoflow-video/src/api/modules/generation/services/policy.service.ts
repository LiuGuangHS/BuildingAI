import { BaseService } from "@buildingai/base";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import type { FindOptionsWhere } from "@buildingai/db/typeorm";
import { In, IsNull, MoreThanOrEqual, Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { Injectable } from "@nestjs/common";

import { VideoGeneration, VideoGenerationStatus } from "../../../db/entities/video-generation.entity";
import { VideoPolicyConfig, VideoPolicyScope } from "../../../db/entities/video-policy-config.entity";
import type { CreateVideoGenerationDto } from "../dto";
import { UpsertVideoPolicyDto } from "../dto";

@Injectable()
export class PolicyService extends BaseService<VideoPolicyConfig> {
    constructor(
        @InjectRepository(VideoPolicyConfig)
        private readonly policyRepository: Repository<VideoPolicyConfig>,
        @InjectRepository(VideoGeneration)
        private readonly generationRepository: Repository<VideoGeneration>,
    ) {
        super(policyRepository);
    }

    async listPolicies() {
        return this.policyRepository.find({
            relations: ["modelConfig"],
            order: { scope: "ASC", createdAt: "DESC" },
        });
    }

    async upsertGlobal(dto: UpsertVideoPolicyDto) {
        return this.upsertPolicy({ ...dto, scope: VideoPolicyScope.GLOBAL, modelConfigId: undefined });
    }

    async upsertModel(modelConfigId: string, dto: UpsertVideoPolicyDto) {
        return this.upsertPolicy({ ...dto, scope: VideoPolicyScope.MODEL, modelConfigId });
    }

    async resolvePolicy(modelConfigId?: string) {
        const global = await this.policyRepository.findOne({
            where: { scope: VideoPolicyScope.GLOBAL, enabled: true } as FindOptionsWhere<VideoPolicyConfig>,
            order: { createdAt: "DESC" },
        });
        const model = modelConfigId
            ? await this.policyRepository.findOne({
                where: { scope: VideoPolicyScope.MODEL, modelConfigId, enabled: true } as FindOptionsWhere<VideoPolicyConfig>,
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

    async validateGeneration(userId: string, modelConfigId: string | undefined, dto: CreateVideoGenerationDto) {
        const policy = await this.resolvePolicy(modelConfigId);
        if (!policy.enabled) return policy;

        if (dto.prompt.length > policy.maxPromptLength) {
            throw HttpErrorFactory.badRequest(`提示词不能超过 ${policy.maxPromptLength} 字`);
        }
        if ((dto.media?.length ?? 0) > policy.maxMediaItemsPerRequest) {
            throw HttpErrorFactory.badRequest(`单次最多提交 ${policy.maxMediaItemsPerRequest} 个媒体素材`);
        }
        const referenceCount = dto.media?.filter((item) => item.type === "reference_image").length ?? 0;
        if (referenceCount > policy.maxReferenceImages) {
            throw HttpErrorFactory.badRequest(`单次最多提交 ${policy.maxReferenceImages} 张参考图`);
        }
        for (const item of dto.media ?? []) {
            if (!item.size || item.size <= 0) continue;
            const maxSizeMb = item.type === "video" ? policy.maxVideoSizeMb : policy.maxImageSizeMb;
            const maxBytes = maxSizeMb * 1024 * 1024;
            if (item.size > maxBytes) {
                throw HttpErrorFactory.badRequest(
                    `${item.type === "video" ? "视频" : "图片"}素材不能超过 ${maxSizeMb}MB`,
                );
            }
        }
        const activeCount = await this.generationRepository.count({
            where: {
                userId,
                status: In([VideoGenerationStatus.PENDING, VideoGenerationStatus.PROCESSING]),
            } as FindOptionsWhere<VideoGeneration>,
        });
        if (activeCount >= policy.maxConcurrentJobsPerUser) {
            throw HttpErrorFactory.badRequest(
                `当前已有 ${activeCount} 个视频任务处理中，请稍后再试`,
            );
        }

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayCount = await this.generationRepository.count({
            where: {
                userId,
                createdAt: MoreThanOrEqual(todayStart),
            } as FindOptionsWhere<VideoGeneration>,
        });
        if (todayCount >= policy.dailyJobsPerUser) {
            throw HttpErrorFactory.badRequest("今日视频生成次数已达上限");
        }

        return policy;
    }

    private async upsertPolicy(dto: UpsertVideoPolicyDto) {
        const existing = await this.policyRepository.findOne({
            where: {
                scope: dto.scope,
                modelConfigId: dto.modelConfigId ?? IsNull(),
            } as FindOptionsWhere<VideoPolicyConfig>,
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
            scope: VideoPolicyScope.GLOBAL,
            maxPromptLength: 4000,
            maxMediaItemsPerRequest: 5,
            maxReferenceImages: 4,
            maxVideoSizeMb: 300,
            maxImageSizeMb: 20,
            maxConcurrentJobsPerUser: 3,
            dailyJobsPerUser: 100,
            enabled: true,
        };
    }
}
