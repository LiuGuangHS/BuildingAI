import { BaseService } from "@buildingai/base";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import type { FindOptionsWhere } from "@buildingai/db/typeorm";
import { In, Like, Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { PublicUserService } from "@buildingai/extension-sdk";
import { buildWhere } from "@buildingai/utils";
import { Injectable } from "@nestjs/common";

import { Article, ArticleStatus } from "../../../db/entities/article.entity";
import { Category } from "../../../db/entities/category.entity";
import { CategoryService } from "../../category/services/category.service";
import { CreateArticleDto, QueryArticleDto, UpdateArticleDto } from "../dto";

const LOCK_TIMEOUT = 'SET LOCAL lock_timeout = 3000';

@Injectable()
export class ArticleService extends BaseService<Article> {
    /**
     * Constructor
     */
    constructor(
        @InjectRepository(Article) private readonly articleRepository: Repository<Article>,
        private readonly categoryService: CategoryService,
        private readonly userService: PublicUserService,
    ) {
        super(articleRepository);
    }

    /**
     * Format author info, return anonymous if author is null
     *
     * @param article Article entity
     * @returns Article with formatted author
     */
    private formatArticleAuthor<T extends Partial<Article>>(article: T): T {
        if (!article.author) {
            return {
                ...article,
                author: {
                    id: null,
                    nickname: "佚名",
                    avatar: null,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any,
            };
        }
        return article;
    }

    /**
     * Format author info for article list
     *
     * @param articles Article list
     * @returns Article list with formatted authors
     */
    private formatArticleListAuthors<T extends Partial<Article>>(articles: T[]): T[] {
        return articles.map((article) => this.formatArticleAuthor(article));
    }

    /**
     * Create an article
     *
     * @param createArticleDto DTO for creating an article
     * @returns Created article
     */
    async createArticle(
        createArticleDto: CreateArticleDto,
        authorId: string,
    ): Promise<Partial<Article>> {
        // Validate category if provided
        if (createArticleDto.categoryId) {
            const category = await this.categoryService.findOneById(createArticleDto.categoryId);
            if (!category) {
                throw HttpErrorFactory.badRequest("Category does not exist");
            }
        }

        const author = await this.userService.findUserById(authorId);

        if (!author) {
            throw HttpErrorFactory.notFound("Author not found");
        }

        // Set default values
        const articleData: Partial<Article> = {
            ...createArticleDto,
            status: createArticleDto.status ?? ArticleStatus.DRAFT,
            sort: createArticleDto.sort ?? 0,
            viewCount: 0,
            author,
        };

        // If status is published, set publishedAt
        if (articleData.status === ArticleStatus.PUBLISHED) {
            articleData.publishedAt = new Date();
        }

        const article = await this.withTransaction(async (entityManager) => {
            await entityManager.query(LOCK_TIMEOUT);
            const saved = await entityManager.getRepository(Article).save(articleData);
            if (createArticleDto.categoryId) {
                await entityManager.getRepository(Category).increment(
                    { id: createArticleDto.categoryId },
                    "articleCount",
                    1,
                );
            }
            return entityManager.getRepository(Article).findOne({
                where: { id: saved.id },
                relations: ["author"],
                select: { author: { id: true, avatar: true, nickname: true } },
            });
        });

        return article;
    }

    /**
     * Query article list
     *
     * @param queryArticleDto DTO for querying articles
     * @returns Article list
     */
    async list(queryArticleDto: QueryArticleDto) {
        const { title, status, categoryId } = queryArticleDto;

        const where = buildWhere<Article>({
            title: title ? Like(`%${title}%`) : undefined,
            status,
            categoryId,
        });

        const result = await this.paginate(queryArticleDto, {
            where,
            relations: ["category", "author"],
            order: { sort: "DESC", createdAt: "DESC" },
            select: {
                author: {
                    id: true,
                    avatar: true,
                    nickname: true,
                },
            },
        });

        // Format authors for all articles
        result.items = this.formatArticleListAuthors(result.items);
        return result;
    }

    /**
     * Get article by id with category relation
     *
     * @param id Article id
     * @returns Article detail
     */
    async findArticleById(id: string): Promise<Article | null> {
        const article = await this.articleRepository.findOne({
            where: { id },
            relations: ["category", "author"],
            select: {
                author: {
                    id: true,
                    avatar: true,
                    nickname: true,
                },
            },
        });

        if (!article) {
            return null;
        }

        return this.formatArticleAuthor(article);
    }

    /**
     * Update an article by id
     *
     * @param id Article id
     * @param updateArticleDto DTO for updating an article
     * @returns Updated article
     */
    async updateArticleById(
        id: string,
        updateArticleDto: UpdateArticleDto,
    ): Promise<Partial<Article>> {
        // Ensure article exists
        const article = await this.articleRepository.findOne({
            where: { id },
        });

        if (!article) {
            throw HttpErrorFactory.notFound(`Article ${id} does not exist`);
        }

        const oldCategoryId = article.categoryId;
        const newCategoryId = updateArticleDto.categoryId;

        // Validate new category if provided
        if (newCategoryId && newCategoryId !== oldCategoryId) {
            const category = await this.categoryService.findOneById(newCategoryId);
            if (!category) {
                throw HttpErrorFactory.badRequest("Category does not exist");
            }
        }

        // Handle status change
        const oldStatus = article.status;
        const newStatus = updateArticleDto.status;

        if (newStatus && newStatus !== oldStatus) {
            if (newStatus === ArticleStatus.PUBLISHED && !article.publishedAt) {
                updateArticleDto["publishedAt"] = new Date();
            }
        }

        // Update article and category counts in transaction
        const updatedArticle = await this.withTransaction(async (entityManager) => {
            await entityManager.query(LOCK_TIMEOUT);
            const saved = await entityManager.getRepository(Article).save({
                ...article,
                ...updateArticleDto,
            });

            if (newCategoryId !== undefined && newCategoryId !== oldCategoryId) {
                if (oldCategoryId) {
                    await entityManager.getRepository(Category).createQueryBuilder()
                        .update(Category)
                        .set({ articleCount: () => "GREATEST(articleCount - 1, 0)" })
                        .where("id = :id", { id: oldCategoryId })
                        .execute();
                }
                if (newCategoryId) {
                    await entityManager.getRepository(Category).increment(
                        { id: newCategoryId },
                        "articleCount",
                        1,
                    );
                }
            }
            return saved;
        });

        return updatedArticle;
    }

    /**
     * Delete article by id
     *
     * @param id Article id
     */
    async delete(id: string): Promise<void> {
        const article = await this.articleRepository.findOne({
            where: { id },
        });

        if (!article) {
            throw HttpErrorFactory.notFound(`Article ${id} does not exist`);
        }

        const categoryId = article.categoryId;

        await this.withTransaction(async (entityManager) => {
            await entityManager.query(LOCK_TIMEOUT);
            if (categoryId) {
                await entityManager.getRepository(Category).createQueryBuilder()
                    .update(Category)
                    .set({ articleCount: () => "GREATEST(articleCount - 1, 0)" })
                    .where("id = :id", { id: categoryId })
                    .execute();
            }
            await entityManager.getRepository(Article).delete({ id });
        });
    }

    /**
     * Batch delete articles
     *
     * @param ids Article ids
     * @returns void
     */
    async batchDelete(ids: string[]): Promise<void> {
        const articles = await this.articleRepository.find({
            where: { id: In(ids) },
        });

        // Aggregate category counts to decrement
        const categoryCountMap = new Map<string, number>();
        for (const article of articles) {
            if (article.categoryId) {
                const count = categoryCountMap.get(article.categoryId) || 0;
                categoryCountMap.set(article.categoryId, count + 1);
            }
        }

        await this.withTransaction(async (entityManager) => {
            await entityManager.query(LOCK_TIMEOUT);
            if (categoryCountMap.size > 0) {
                const cases = Array.from(categoryCountMap.entries())
                    .map(([id, count]) => `WHEN id = '${id}' THEN ${count}`)
                    .join(" ");
                await entityManager.getRepository(Category).createQueryBuilder()
                    .update(Category)
                    .set({ articleCount: () => `GREATEST(articleCount - CASE ${cases} ELSE 0 END, 0)` })
                    .where("id IN (:...ids)", { ids: Array.from(categoryCountMap.keys()) })
                    .execute();
            }
            await entityManager.getRepository(Article).delete({ id: In(ids) });
        });
    }

    /**
     * Publish article
     *
     * @param id Article id
     * @returns Updated article
     */
    async publish(id: string): Promise<Partial<Article>> {
        const article = await this.articleRepository.findOne({
            where: { id },
        });

        if (!article) {
            throw HttpErrorFactory.notFound(`Article ${id} does not exist`);
        }

        article.publish();
        await this.articleRepository.save(article);

        return article;
    }

    /**
     * Unpublish article (revert to draft)
     *
     * @param id Article id
     * @returns Updated article
     */
    async unpublish(id: string): Promise<Partial<Article>> {
        const article = await this.articleRepository.findOne({
            where: { id },
        });

        if (!article) {
            throw HttpErrorFactory.notFound(`Article ${id} does not exist`);
        }

        article.unpublish();
        await this.articleRepository.save(article);

        return article;
    }

    /**
     * Increment article view count
     *
     * @param id Article id
     */
    async incrementViewCount(id: string): Promise<void> {
        const result = await this.articleRepository.increment({ id }, "viewCount", 1);
        if (!result.affected) {
            throw HttpErrorFactory.notFound(`Article ${id} does not exist`);
        }
    }

    /**
     * Get published articles
     *
     * @param categoryId Optional category filter
     * @returns Published article list
     */
    async getPublishedArticles(categoryId?: string): Promise<Article[]> {
        const where: FindOptionsWhere<Article> = {
            status: ArticleStatus.PUBLISHED,
        };

        if (categoryId) {
            where.categoryId = categoryId;
        }

        const articles = await this.articleRepository.find({
            where,
            relations: ["category", "author"],
            order: { publishedAt: "DESC", sort: "DESC" },
            take: 50,
            select: {
                author: {
                    id: true,
                    avatar: true,
                    nickname: true,
                },
            },
        });

        return this.formatArticleListAuthors(articles);
    }
}
