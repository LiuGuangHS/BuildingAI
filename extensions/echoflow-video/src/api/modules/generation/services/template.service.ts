import { BaseService } from "@buildingai/base";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import type { FindOptionsWhere } from "@buildingai/db/typeorm";
import { Like, Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { buildDefinedWhere } from "@buildingai/extension-sdk";
import { Injectable } from "@nestjs/common";

import { VideoPromptTemplate } from "../../../db/entities/video-prompt-template.entity";
import { CreateVideoTemplateDto, QueryVideoTemplateDto, UpdateVideoTemplateDto } from "../dto";

@Injectable()
export class TemplateService extends BaseService<VideoPromptTemplate> {
    constructor(
        @InjectRepository(VideoPromptTemplate)
        private readonly templateRepository: Repository<VideoPromptTemplate>,
    ) {
        super(templateRepository);
    }

    async list(query: QueryVideoTemplateDto, webOnly = false) {
        const where = buildDefinedWhere<FindOptionsWhere<VideoPromptTemplate>>({
            title: query.keyword ? Like(`%${query.keyword}%`) : undefined,
            category: query.category,
            modelConfigId: query.modelConfigId,
            enabled: webOnly ? true : query.enabled,
        });

        return this.paginate(query, {
            where,
            relations: ["modelConfig"],
            order: { sortOrder: "DESC", createdAt: "DESC" },
        });
    }

    async listPublicTemplates(query: QueryVideoTemplateDto) {
        if (!query.abilityType) return this.list(query, true);

        const allResult = await this.templateRepository.findAndCount({
            where: buildDefinedWhere<FindOptionsWhere<VideoPromptTemplate>>({
                title: query.keyword ? Like(`%${query.keyword}%`) : undefined,
                category: query.category,
                modelConfigId: query.modelConfigId,
                enabled: true,
            }),
            relations: ["modelConfig"],
            order: { sortOrder: "DESC", createdAt: "DESC" },
        });
        const filtered = allResult[0].filter((item) =>
            !item.abilityTypes?.length || item.abilityTypes.includes(query.abilityType!),
        );
        const page = Math.max(1, Number(query.page ?? 1));
        const pageSize = Math.max(1, Math.min(100, Number(query.pageSize ?? 20)));
        const start = (page - 1) * pageSize;
        return {
            items: filtered.slice(start, start + pageSize),
            total: filtered.length,
            page,
            pageSize,
        };
    }

    async createTemplate(dto: CreateVideoTemplateDto) {
        return this.templateRepository.save(
            this.templateRepository.create({
                ...dto,
                category: dto.category ?? "default",
                abilityTypes: dto.abilityTypes ?? [],
                defaultParams: dto.defaultParams ?? {},
                enabled: dto.enabled ?? true,
                sortOrder: dto.sortOrder ?? 0,
            }),
        );
    }

    async updateTemplate(id: string, dto: UpdateVideoTemplateDto) {
        const template = await this.templateRepository.findOne({
            where: { id } as FindOptionsWhere<VideoPromptTemplate>,
        });
        if (!template) {
            throw HttpErrorFactory.notFound("视频模板不存在");
        }

        Object.assign(template, dto);
        return this.templateRepository.save(template);
    }

    async deleteTemplate(id: string) {
        await this.delete(id);
        return { success: true, message: "删除成功" };
    }
}
