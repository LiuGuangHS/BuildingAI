import { BaseService } from "@buildingai/base";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import type { FindOptionsWhere } from "@buildingai/db/typeorm";
import { Like, Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { buildWhere } from "@buildingai/utils";
import { Injectable } from "@nestjs/common";

import { ImagePromptTemplate } from "../../../db/entities/image-prompt-template.entity";
import { CreateTemplateDto, QueryTemplateDto, UpdateTemplateDto } from "../dto";

@Injectable()
export class TemplateService extends BaseService<ImagePromptTemplate> {
    constructor(
        @InjectRepository(ImagePromptTemplate)
        private readonly templateRepository: Repository<ImagePromptTemplate>,
    ) {
        super(templateRepository);
    }

    async list(query: QueryTemplateDto, webOnly = false) {
        const where = buildWhere<ImagePromptTemplate>({
            title: query.keyword ? Like(`%${query.keyword}%`) : undefined,
            category: query.category,
            enabled: webOnly ? true : query.enabled,
        });

        return this.paginate(query, {
            where,
            order: { sortOrder: "DESC", createdAt: "DESC" },
        });
    }

    async createTemplate(dto: CreateTemplateDto) {
        return this.templateRepository.save(
            this.templateRepository.create({
                ...dto,
                category: dto.category ?? "default",
                defaultParams: dto.defaultParams ?? {},
                enabled: dto.enabled ?? true,
                sortOrder: dto.sortOrder ?? 0,
            }),
        );
    }

    async updateTemplate(id: string, dto: UpdateTemplateDto) {
        const template = await this.templateRepository.findOne({
            where: { id } as FindOptionsWhere<ImagePromptTemplate>,
        });
        if (!template) {
            throw HttpErrorFactory.notFound("模板不存在");
        }

        Object.assign(template, dto);
        return this.templateRepository.save(template);
    }

    async deleteTemplate(id: string) {
        await this.delete(id);
        return { success: true, message: "删除成功" };
    }
}
