import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { Brackets, EntityManager, Repository } from "@buildingai/db/typeorm";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { TownCharacter, TownEvent, TownSave, type TownCharacterMemory, type TownEventChoice, type TownEventResult, type TownWorldState } from "../../../db/entities";
import { TOWN_ACTION_CATALOG, TOWN_CHARACTER_CATALOG, TOWN_CHOICE_ACTION_OVERRIDES, TOWN_INITIAL_AREAS, createDefaultTownBuildings, createTownChoiceCatalog, resolveTownActionCatalogValue } from "../catalog";
import { type CreateTownSaveDto, type QueryTownSaveDto, type TownActionDto, type TownChatDto } from "../dto";
import { TownAiService } from "./town-ai.service";
import { TownProgressRulesService, type ProgressContext, type ProgressResult, type TownGoal, type TownQuestState, type TownTask } from "./town-progress-rules.service";
import { TownRelationshipRulesService, type RelationshipBonus, type RelationshipUpdate } from "./town-relationship-rules.service";
import { TownWorldRulesService, type TownFestivalState } from "./town-world-rules.service";

const DEFAULT_PAGE_SIZE = 20;

type TownSaveDetail = TownSave & {
    characters: TownCharacter[];
    events: TownEvent[];
    suggestion: string;
};

type ActionConfig = {
    title: string;
    content: string;
    coins: number;
    stamina: number;
    reputation: number;
    mood: string;
    focus: string;
    upgradedBuildingId?: string;
};

type TownActionBudgetState = {
    day: number;
    maxPerDay: number;
    usedActions: string[];
    lastActionAt?: string;
};

type TownSettlement = NonNullable<TownWorldState["lastSettlement"]>;
type TownRetentionState = NonNullable<TownWorldState["retention"]>;
type TownRetentionHook = TownRetentionState["nextHook"];
type RetentionActionInput = TownActionDto["action"] | "chat";
type PreparedActionAi = {
    content?: string;
    eventTitle?: string;
    eventChoices?: TownEventChoice[];
    strategy?: TownEventResult["strategy"];
    fallbackUsed?: boolean;
};
type TownActionAuditContext = {
    action: TownActionDto["action"];
    source: NonNullable<TownEventResult["audit"]>["source"];
    day: number;
    choice?: TownEventChoice | null;
    building?: { id: string; name: string } | null;
    relationshipTarget?: Pick<TownCharacter, "id" | "name"> | null;
    budgetBefore?: TownActionBudgetState | null;
    budgetAfter?: TownActionBudgetState | null;
    budgetConsumed?: boolean;
    settlement?: TownSettlement | null;
    bonuses?: string[];
    modelAssisted?: boolean;
    fallbackUsed?: boolean;
};

@Injectable()
export class TownService {
    private readonly saveRepo: Repository<TownSave>;
    private readonly characterRepo: Repository<TownCharacter>;
    private readonly eventRepo: Repository<TownEvent>;
    private readonly townAiService: TownAiService;
    private readonly townWorldRulesService: TownWorldRulesService;
    private readonly townRelationshipRulesService: TownRelationshipRulesService;
    private readonly townProgressRulesService: TownProgressRulesService;

    constructor(
        @InjectRepository(TownSave)
        saveRepo: Repository<TownSave>,
        @InjectRepository(TownCharacter)
        characterRepo: Repository<TownCharacter>,
        @InjectRepository(TownEvent)
        eventRepo: Repository<TownEvent>,
        townAiService: TownAiService,
        townWorldRulesService: TownWorldRulesService,
        townRelationshipRulesService: TownRelationshipRulesService,
        townProgressRulesService: TownProgressRulesService,
    ) {
        this.saveRepo = saveRepo;
        this.characterRepo = characterRepo;
        this.eventRepo = eventRepo;
        this.townAiService = townAiService;
        this.townWorldRulesService = townWorldRulesService;
        this.townRelationshipRulesService = townRelationshipRulesService;
        this.townProgressRulesService = townProgressRulesService;
    }

    async createSave(userId: string, dto: CreateTownSaveDto) {
        const save = this.saveRepo.create({
            userId,
            name: dto.name?.trim() || "乐园小镇",
            level: 1,
            coins: 120,
            stamina: 100,
            day: 1,
            mood: "期待",
            worldState: this.createDefaultWorldState(),
        });

        let createdSaveId = "";
        await this.saveRepo.manager.transaction(async (manager) => {
            const saved = await manager.save(TownSave, save);
            createdSaveId = saved.id;
            await manager.save(TownCharacter, this.createDefaultCharacters(userId, saved.id));
            await manager.save(
                TownEvent,
                this.eventRepo.create({
                    userId,
                    saveId: saved.id,
                    type: "system",
                    title: "小镇启程",
                    content: "第一天清晨，小镇广播响起。居民们期待你规划今天的经营方向，厨房、花店和广场都已经准备好迎接新故事。",
                    choices: [
                        { id: "operate", label: "经营餐馆", hint: "赚取金币，消耗体力" },
                        { id: "visit", label: "拜访居民", hint: "提升关系，发现剧情" },
                        { id: "explore", label: "探索街区", hint: "触发随机事件" },
                    ],
                    result: null,
                }),
            );
        });

        return this.getSaveDetail(userId, createdSaveId);
    }

    async getUserSaves(userId: string, query: QueryTownSaveDto) {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
        const [list, total] = await this.buildSaveQuery(query)
            .andWhere("save.userId = :userId", { userId })
            .skip((page - 1) * pageSize)
            .take(pageSize)
            .getManyAndCount();

        return { list, total, page, pageSize };
    }

    async getAllSaves(query: QueryTownSaveDto) {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
        const [list, total] = await this.buildSaveQuery(query)
            .skip((page - 1) * pageSize)
            .take(pageSize)
            .getManyAndCount();

        return { list, total, page, pageSize };
    }

    async getSaveDetailByAdmin(saveId: string): Promise<TownSaveDetail> {
        const save = await this.saveRepo.findOne({
            where: { id: saveId },
            relations: { characters: true, events: true },
        });

        if (!save) {
            throw new NotFoundException("小镇存档不存在");
        }

        return this.hydrateSave(save);
    }

    async getSaveDetail(userId: string, saveId: string): Promise<TownSaveDetail> {
        const save = await this.saveRepo.findOne({
            where: { id: saveId, userId },
            relations: { characters: true, events: true },
        });

        if (!save) {
            throw new NotFoundException("小镇存档不存在");
        }

        return this.hydrateSave(save);
    }

    async getEvents(userId: string, saveId: string) {
        await this.ensureSaveOwner(userId, saveId);
        return this.eventRepo.find({ where: { userId, saveId }, order: { createdAt: "DESC" }, take: 50 });
    }

    async runAction(userId: string, saveId: string, dto: TownActionDto) {
        const preparedAi = await this.prepareActionAi(userId, saveId, dto);

        await this.saveRepo.manager.transaction(async (manager) => {
            const save = await this.ensureSaveOwnerForUpdate(userId, saveId, manager);
            const characters = await manager.find(TownCharacter, { where: { userId, saveId }, order: { relationship: "DESC" } });
            const bonuses = this.getRelationshipBonuses(characters, dto.action);
            const choice = this.resolveChoice(dto);
            const auditDay = save.day;
            const auditBudgetBefore = this.getActionBudgetState(save);
            const auditBuilding = this.getAuditBuilding(save, dto.buildingId);
            const config = this.applyRelationshipBonuses(this.createActionConfig(dto.action, save, characters, choice, dto.buildingId), bonuses);
            this.ensureActionAffordable(save, dto.action, config);
            const settlement = dto.action === "rest" ? this.createDailySettlement(save) : null;
            const auditContext: TownActionAuditContext = {
                action: dto.action,
                source: settlement ? "settlement" : preparedAi ? "model-assisted" : "rules",
                day: auditDay,
                choice,
                building: auditBuilding,
                budgetBefore: auditBudgetBefore,
                settlement,
                bonuses: bonuses.map((bonus) => bonus.label),
                modelAssisted: Boolean(preparedAi),
                fallbackUsed: Boolean(preparedAi?.fallbackUsed),
            };
            const result = this.applyResult(save, {
                coins: config.coins,
                stamina: config.stamina,
                reputation: config.reputation + (settlement?.reputation ?? 0),
            }, auditContext);
            if (bonuses.length) {
                result.bonuses = bonuses.map((bonus) => bonus.label);
            }
            if (settlement) {
                result.coins = (result.coins ?? 0) + settlement.income - settlement.maintenance;
                save.coins = Math.max(0, save.coins + settlement.income - settlement.maintenance);
                this.refreshResultAudit(save, result, auditContext);
            }

            save.day += dto.action === "rest" ? 1 : 0;
            save.mood = config.mood;
            save.worldState = { ...this.normalizeWorldState(save.worldState, save.day), focus: config.focus };
            if (settlement) {
                const currentDay = save.day;
                save.worldState = {
                    ...save.worldState,
                    weather: settlement.weather,
                    focus: "新的一天",
                    lastSettlement: settlement,
                    dailyTasks: this.createDailyTasks(currentDay),
                    weeklyGoal: this.shouldRefreshWeeklyGoal(save.worldState.weeklyGoal, currentDay) ? this.createWeeklyGoal({ ...save, day: currentDay }) : save.worldState.weeklyGoal,
                };
            }
            if (config.upgradedBuildingId) {
                save.worldState = this.upgradeBuilding(save.worldState, config.upgradedBuildingId);
            }
            const progress = this.applyProgress(save, {
                action: dto.action,
                coinsDelta: result.coins,
                reputationDelta: result.reputation,
                skipDailyProgress: dto.action === "rest",
            });
            const unlockedAreas = this.applyAreaUnlocks(save);
            const relationshipTarget = await this.pickRelationshipTarget(userId, save, choice?.id ?? dto.action, manager);
            if (relationshipTarget) {
                result.relationship = { [relationshipTarget.id]: this.getRelationshipDelta(choice?.id ?? dto.action) };
                auditContext.relationshipTarget = { id: relationshipTarget.id, name: relationshipTarget.name };
            }

            if (preparedAi?.strategy) {
                result.strategy = preparedAi.strategy;
            }
            if (preparedAi?.fallbackUsed) {
                result.fallbackUsed = true;
            }
            const eventTitle = preparedAi?.eventTitle || config.title;
            const eventChoices = preparedAi?.eventChoices ?? this.createNextChoices(dto.action);
            const content = preparedAi?.content ?? (settlement ? `${config.content}\n${settlement.summary}` : config.content);
            const relationshipEvents = await this.applyRelationshipResult(manager, userId, saveId, result, relationshipTarget, dto.action, save.day);
            const latestCharacters = await manager.find(TownCharacter, { where: { userId, saveId }, order: { relationship: "DESC" } });
            const activityEvents = this.createActivityEvents(userId, saveId, save, dto.action);
            if (dto.action === "rest") {
                this.advanceRetentionAfterRest(save, latestCharacters);
            } else {
                this.markRetentionQualified(save, dto.action, progress, latestCharacters);
            }
            const consumedBudget = this.consumeActionBudget(save, dto.action);
            auditContext.budgetAfter = this.getActionBudgetState(save);
            auditContext.budgetConsumed = consumedBudget;
            this.refreshResultAudit(save, result, auditContext);

            await manager.save(TownSave, save);
            await manager.save(
                TownEvent,
                this.eventRepo.create({
                    userId,
                    saveId,
                    type: dto.action,
                    title: eventTitle,
                    content,
                    choices: eventChoices,
                    result,
                }),
            );
            if (relationshipEvents.length) {
                await manager.save(TownEvent, relationshipEvents);
            }
            if (unlockedAreas.length) {
                await manager.save(
                    TownEvent,
                    unlockedAreas.map((area) => this.eventRepo.create({
                        userId,
                        saveId,
                        type: "unlock",
                        title: `解锁新区域：${area}`,
                        content: `${area}向你开放了。新的居民传闻、街区任务和探索事件会从这里慢慢出现。`,
                        choices: this.createNextChoices("explore"),
                        result: { reputation: 1 },
                    })),
                );
            }
            const progressEvents = [
                ...this.createProgressEvents(userId, saveId, progress, dto.action),
            ];
            if (progressEvents.length) {
                await manager.save(TownEvent, progressEvents);
            }
            if (activityEvents.length) {
                await manager.save(TownEvent, activityEvents);
            }
        });

        return this.getSaveDetail(userId, saveId);
    }

    private async prepareActionAi(userId: string, saveId: string, dto: TownActionDto): Promise<PreparedActionAi | null> {
        if (dto.action !== "advice" && dto.action !== "explore") return null;

        const save = await this.ensureSaveOwner(userId, saveId);
        const characters = await this.characterRepo.find({ where: { userId, saveId }, order: { relationship: "DESC" } });
        const choice = this.resolveChoice(dto);
        const bonuses = this.getRelationshipBonuses(characters, dto.action);
        const config = this.applyRelationshipBonuses(
            this.createActionConfig(dto.action, save, characters, choice, dto.buildingId),
            bonuses,
        );
        this.ensureActionAffordable(save, dto.action, config);
        const aiContext = { ...(await this.buildAiContext(userId, save)), choice };

        if (dto.action === "advice") {
            const advice = await this.townAiService.generateStrategy(aiContext, config.content);
            return {
                content: advice.strategy.summary,
                strategy: advice.strategy,
                fallbackUsed: advice.fallbackUsed,
            };
        }

        const event = await this.townAiService.generateStructuredEvent(aiContext, config.content);
        return {
            content: event.content,
            eventTitle: event.title || config.title,
            eventChoices: event.choices ?? this.createNextChoices(dto.action),
            fallbackUsed: event.fallbackUsed,
        };
    }

    async chat(userId: string, saveId: string, dto: TownChatDto) {
        let characterResult: TownCharacter | null = null;
        const saveSnapshot = await this.ensureSaveOwner(userId, saveId);
        const selectedCharacter = await this.characterRepo.findOne({ where: { id: dto.characterId, userId, saveId } });
        if (!selectedCharacter) {
            throw new NotFoundException("小镇居民不存在");
        }
        const fallbackReply = this.createNpcReply(selectedCharacter, dto.message);
        const replyResult = await this.townAiService.generateNpcReply(
            {
                ...(await this.buildAiContext(userId, saveSnapshot)),
                character: selectedCharacter,
                message: dto.message,
            },
            fallbackReply,
        );

        await this.saveRepo.manager.transaction(async (manager) => {
            const save = await this.ensureSaveOwnerForUpdate(userId, saveId, manager);
            const character = await manager.findOne(TownCharacter, {
                where: { id: dto.characterId, userId, saveId },
                lock: { mode: "pessimistic_write" },
            });
            if (!character) {
                throw new NotFoundException("小镇居民不存在");
            }

            const oldLevel = this.getRelationshipLevel(character.relationship);
            character.relationship = Math.min(100, character.relationship + 3);
            const newLevel = this.getRelationshipLevel(character.relationship);
            character.status = "刚聊过天";
            character.memory = this.updateCharacterMemory(character, dto.message, replyResult, save.day);

            const progress = this.applyProgress(save, { action: "chat" });
            this.markRetentionQualified(save, "chat", progress, [character]);
            await manager.save(TownCharacter, character);
            await manager.save(TownSave, save);
            const chatResult = this.createChatResult(save, character);
            await manager.save(
                TownEvent,
                this.eventRepo.create({
                    userId,
                    saveId,
                    type: "chat",
                    title: `和${character.name}聊天`,
                    content: replyResult,
                    choices: null,
                    result: chatResult,
                }),
            );
            const progressEvents = this.createProgressEvents(userId, saveId, progress, "visit");
            if (progressEvents.length) {
                await manager.save(TownEvent, progressEvents);
            }
            if (oldLevel !== newLevel) {
                await manager.save(TownEvent, this.createRelationshipLevelEvent(userId, saveId, character, oldLevel, newLevel, 3));
            }
            characterResult = character;
        });

        return { character: characterResult, reply: replyResult, save: await this.getSaveDetail(userId, saveId) };
    }

    private updateCharacterMemory(character: TownCharacter, message: string, reply: string, day: number): TownCharacterMemory {
        const current = character.memory ?? {};
        const recentMessages = Array.isArray(current.recentMessages) ? current.recentMessages.slice(-5) : [];
        const nextRecentMessages = [...recentMessages, { user: message, reply, at: new Date().toISOString() }];
        const preference = this.extractPreference(message);
        const promise = this.extractPromise(message, reply);
        const keyMoment = this.createKeyMoment(character, message, reply, day);
        const preferences = this.mergeLimitedStrings(current.preferences, preference ? [preference] : [], 6);
        const promises = this.mergeLimitedStrings(current.promises, promise ? [promise] : [], 5);
        const keyMoments = this.mergeLimitedMoments(current.keyMoments, keyMoment ? [keyMoment] : [], 5);
        return {
            ...current,
            lastMessage: message,
            lastReply: reply,
            relationshipLevel: this.getRelationshipLevel(character.relationship),
            mood: this.inferMemoryMood(message, reply),
            preferences,
            promises,
            keyMoments,
            summary: this.summarizeCharacterMemory(character, nextRecentMessages, preferences, keyMoments),
            recentMessages: nextRecentMessages.slice(-6),
        };
    }

    private createChatResult(save: TownSave, character: TownCharacter): TownEventResult {
        const result: TownEventResult = { relationship: { [character.id]: 3 } };
        const before = this.createResultSnapshot(save);
        result.audit = {
            before,
            after: before,
            deltas: { coins: 0, stamina: 0, reputation: 0, level: 0 },
            ruleRefs: ["action:chat", "rule:relationship-memory"],
            source: "model-assisted",
            action: {
                type: "chat",
                label: "居民聊天",
                day: save.day,
                relationshipTargetId: character.id,
                relationshipTargetName: character.name,
            },
            resourceBreakdown: [{ label: "关系推进", value: 3, detail: `${character.name}聊天记忆` }],
            model: { assisted: true, fallbackUsed: false },
            notes: [`${character.name}关系 +3`, "居民记忆已更新"],
        };
        return result;
    }

    private summarizeCharacterMemory(character: TownCharacter, recentMessages: Array<{ user: string; reply: string; at: string }>, preferences: string[], keyMoments: Array<{ day: number; title: string; summary: string }>) {
        const latest = recentMessages.at(-1);
        const preferenceText = preferences.length ? `偏好：${preferences.slice(-2).join("、")}。` : "";
        const momentText = keyMoments.length ? `记得${keyMoments.at(-1)?.title}。` : "";
        const latestText = latest ? `最近聊到“${latest.user.trim().slice(0, 24)}”。` : "";
        return `${character.name}${latestText}${preferenceText}${momentText}`.slice(0, 160);
    }

    private extractPreference(message: string) {
        const text = message.trim();
        if (!text) return null;
        const keywords = ["喜欢", "想要", "希望", "偏好", "爱吃", "想参加"];
        const matched = keywords.find((keyword) => text.includes(keyword));
        if (!matched) return null;
        return text.slice(Math.max(0, text.indexOf(matched)), Math.max(text.indexOf(matched) + matched.length + 28, 18)).slice(0, 36);
    }

    private extractPromise(message: string, reply: string) {
        const text = `${message} ${reply}`;
        if (!["下次", "明天", "约好", "记得", "答应"].some((keyword) => text.includes(keyword))) return null;
        return message.trim().slice(0, 42);
    }

    private createKeyMoment(character: TownCharacter, message: string, reply: string, day: number) {
        if (message.length < 10 && reply.length < 20 && character.relationship < 40) return null;
        return {
            day,
            title: `Day ${day} 的对话`,
            summary: `${message.trim().slice(0, 28)} / ${reply.trim().slice(0, 36)}`,
        };
    }

    private inferMemoryMood(message: string, reply: string) {
        const text = `${message} ${reply}`;
        if (["谢谢", "开心", "喜欢", "期待"].some((keyword) => text.includes(keyword))) return "亲近";
        if (["担心", "困难", "累", "不安"].some((keyword) => text.includes(keyword))) return "关切";
        if (["活动", "庆典", "计划", "明天"].some((keyword) => text.includes(keyword))) return "期待";
        return "平和";
    }

    private mergeLimitedStrings(current: unknown, additions: string[], limit: number) {
        const source = Array.isArray(current) ? current.filter((item): item is string => typeof item === "string") : [];
        return [...new Set([...source, ...additions].filter(Boolean))].slice(-limit);
    }

    private mergeLimitedMoments(current: unknown, additions: Array<{ day: number; title: string; summary: string }>, limit: number) {
        const source = Array.isArray(current)
            ? current.filter((item): item is { day: number; title: string; summary: string } => item && typeof item.day === "number" && typeof item.title === "string" && typeof item.summary === "string")
            : [];
        return [...source, ...additions].slice(-limit);
    }

    private createProgressEvents(userId: string, saveId: string, progress: ProgressResult, action: TownActionDto["action"]): TownEvent[] {
        return [
            ...progress.completedTasks.map((task) => this.eventRepo.create({
                    userId,
                    saveId,
                    type: "task",
                    title: `任务完成：${task.title}`,
                    content: `${task.desc} 奖励已发放：金币 ${task.reward.coins ?? 0}，体力 ${task.reward.stamina ?? 0}，声望 ${task.reward.reputation ?? 0}。`,
                    choices: this.createNextChoices(action),
                    result: task.reward,
                })),
            ...(progress.completedWeeklyGoal ? [this.eventRepo.create({
                userId,
                saveId,
                type: "weekly",
                title: `周目标完成：${progress.completedWeeklyGoal.title}`,
                content: `${progress.completedWeeklyGoal.desc} 奖励已发放：金币 ${progress.completedWeeklyGoal.reward.coins ?? 0}，体力 ${progress.completedWeeklyGoal.reward.stamina ?? 0}，声望 ${progress.completedWeeklyGoal.reward.reputation ?? 0}。`,
                choices: this.createNextChoices(action),
                result: progress.completedWeeklyGoal.reward,
            })] : []),
            ...(progress.questCompleted ? [this.eventRepo.create({
                    userId,
                    saveId,
                    type: "quest",
                    title: `主线推进：${progress.questCompleted.title}`,
                    content: `${progress.questCompleted.desc} 小镇进入了新的阶段，居民们把这一天记进了公告板。`,
                    choices: this.createNextChoices("explore"),
                    result: progress.questCompleted.reward,
                })] : []),
            ...progress.achievements.map((achievement) => this.eventRepo.create({
                    userId,
                    saveId,
                    type: "achievement",
                    title: `成就达成：${achievement}`,
                    content: `你完成了“${achievement}”。这会成为小镇长期经营的一枚徽章。`,
                    choices: null,
                    result: { reputation: 1 },
                })),
        ];
    }

    async deleteSave(userId: string, saveId: string) {
        const save = await this.ensureSaveOwner(userId, saveId);
        await this.softDeleteSaveGraph(save);
    }

    async deleteSaveByAdmin(saveId: string) {
        const save = await this.saveRepo.findOne({ where: { id: saveId } });
        if (!save) {
            throw new NotFoundException("小镇存档不存在");
        }
        await this.softDeleteSaveGraph(save);
    }

    async getStatistics() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const recentDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const [saveCount, characterCount, eventCount, chatCount, aiEventCount, activeSaveCount, todaySaveCount, recentActionCount, saves, topAction] = await Promise.all([
            this.saveRepo.count(),
            this.characterRepo.count(),
            this.eventRepo.count(),
            this.eventRepo.count({ where: { type: "chat" } }),
            this.eventRepo.createQueryBuilder("event").where("event.type IN (:...types)", { types: ["advice", "explore"] }).getCount(),
            this.saveRepo.createQueryBuilder("save").where("save.updatedAt >= :date", { date: recentDate }).getCount(),
            this.saveRepo.createQueryBuilder("save").where("save.createdAt >= :date", { date: today }).getCount(),
            this.eventRepo.createQueryBuilder("event").where("event.createdAt >= :date", { date: recentDate }).andWhere("event.type IN (:...types)", { types: ["operate", "visit", "decorate", "explore", "rest", "upgrade", "advice", "chat"] }).getCount(),
            this.saveRepo.find({ take: 200, order: { updatedAt: "DESC" } }),
            this.eventRepo.createQueryBuilder("event")
                .select("event.type", "type")
                .addSelect("COUNT(event.id)", "count")
                .where("event.type IN (:...types)", { types: ["operate", "visit", "decorate", "explore", "rest", "upgrade", "advice", "chat"] })
                .groupBy("event.type")
                .orderBy("count", "DESC")
                .limit(1)
                .getRawOne<{ type: string; count: string }>(),
        ]);

        const averageDay = saves.length ? Math.round(saves.reduce((total, save) => total + save.day, 0) / saves.length) : 0;
        const averageLevel = saves.length ? Math.round((saves.reduce((total, save) => total + save.level, 0) / saves.length) * 10) / 10 : 0;
        const saveEventCounts = await Promise.all(saves.map(async (save) => ({ save, eventCount: await this.eventRepo.count({ where: { saveId: save.id } }) })));
        const stuckSaveCount = saveEventCounts.filter(({ save, eventCount }) => save.day > 3 && eventCount === 0).length;
        const averageEventCount = saveEventCounts.length ? Math.round((saveEventCounts.reduce((total, item) => total + item.eventCount, 0) / saveEventCounts.length) * 10) / 10 : 0;
        const aiStats = await this.townAiService.getLogStats();
        const aiSuccessRate = aiStats.total ? Math.round(((aiStats.total - aiStats.failed) / aiStats.total) * 1000) / 10 : 100;
        const aiFallbackRate = aiStats.total ? Math.round((aiStats.fallback / aiStats.total) * 1000) / 10 : 0;
        return { saveCount, characterCount, eventCount, chatCount, aiEventCount, activeSaveCount, averageDay, averageLevel, stuckSaveCount, todaySaveCount, recentActionCount, averageEventCount, aiSuccessRate, aiFallbackRate, topActionType: topAction?.type ?? null };
    }

    private async softDeleteSaveGraph(save: TownSave) {
        await this.saveRepo.manager.transaction(async (manager) => {
            await manager.softDelete(TownEvent, { saveId: save.id });
            await manager.softDelete(TownCharacter, { saveId: save.id });
            await manager.softDelete(TownSave, { id: save.id });
        });
    }

    private buildSaveQuery(query: QueryTownSaveDto) {
        const queryBuilder = this.saveRepo.createQueryBuilder("save").orderBy("save.updatedAt", "DESC");
        if (query.keyword) {
            queryBuilder.andWhere(
                new Brackets((qb) => {
                    qb.where("save.name ILIKE :keyword", { keyword: `%${query.keyword}%` }).orWhere("save.mood ILIKE :keyword", {
                        keyword: `%${query.keyword}%`,
                    });
                }),
            );
        }
        return queryBuilder;
    }

    private async ensureSaveOwner(userId: string, saveId: string) {
        const save = await this.saveRepo.findOne({ where: { id: saveId, userId } });
        if (!save) {
            throw new NotFoundException("小镇存档不存在");
        }
        return save;
    }

    private async ensureSaveOwnerForUpdate(userId: string, saveId: string, manager: EntityManager) {
        const save = await manager.findOne(TownSave, {
            where: { id: saveId, userId },
            lock: { mode: "pessimistic_write" },
        });
        if (!save) {
            throw new NotFoundException("小镇存档不存在");
        }
        return save;
    }

    private hydrateSave(save: TownSave): TownSaveDetail {
        const events = [...(save.events ?? [])].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 20);
        const characters = [...(save.characters ?? [])].sort((a, b) => b.relationship - a.relationship);

        return {
            ...save,
            worldState: this.normalizeWorldState(save.worldState, save.day),
            characters,
            events,
            suggestion: this.createSuggestion(save),
        };
    }

    private createDefaultWorldState(): TownWorldState {
        return {
            reputation: 12,
            weather: "晴朗",
            focus: "开业准备",
            unlockedAreas: [...TOWN_INITIAL_AREAS],
            buildings: createDefaultTownBuildings(),
            flags: {},
            dailyTasks: this.createDailyTasks(1),
            weeklyGoal: this.createWeeklyGoal(),
            mainQuest: this.createMainQuest(1),
            achievements: [],
            activeFestival: null,
            lastSettlement: null,
            retention: this.createRetentionState(1),
        };
    }

    private createDefaultCharacters(userId: string, saveId: string): TownCharacter[] {
        return TOWN_CHARACTER_CATALOG.map((character) => this.characterRepo.create({ userId, saveId, ...character, memory: {} }));
    }

    private normalizeWorldState(worldState?: TownWorldState | null, day = 1): TownWorldState {
        const defaults = this.createDefaultWorldState();
        const nextWorldState = {
            ...defaults,
            ...(worldState ?? {}),
            flags: {
                ...(defaults.flags ?? {}),
                ...(worldState?.flags ?? {}),
            },
        };
        nextWorldState.buildings = defaults.buildings.map((defaultBuilding) => ({
            ...defaultBuilding,
            ...(worldState?.buildings ?? []).find((building) => building.id === defaultBuilding.id),
        }));
        nextWorldState.dailyTasks = worldState?.dailyTasks?.length ? worldState.dailyTasks : defaults.dailyTasks;
        nextWorldState.weeklyGoal = worldState?.weeklyGoal ?? defaults.weeklyGoal;
        nextWorldState.mainQuest = worldState?.mainQuest ?? defaults.mainQuest;
        nextWorldState.achievements = worldState?.achievements ?? defaults.achievements;
        nextWorldState.activeFestival = worldState?.activeFestival ?? null;
        nextWorldState.retention = this.normalizeRetentionState(worldState?.retention, nextWorldState, day);
        return nextWorldState;
    }

    private createRetentionState(day: number, streak = 0, todayQualified = false): TownRetentionState {
        return {
            streak,
            lastQualifiedDay: todayQualified ? day : Math.max(0, day - 1),
            todayQualified,
            nextHook: {
                day,
                title: "开张第一天",
                desc: "先经营餐馆或拜访居民，让小镇形成第一条可延续的日程。",
                action: "operate",
                target: "restaurant",
                targetLabel: "暖光餐馆",
                reason: "初始小镇需要稳定现金流和居民关系。",
            },
        };
    }

    private normalizeRetentionState(retention: unknown, worldState: TownWorldState, day: number): TownRetentionState {
        const source = retention && typeof retention === "object" ? retention as Partial<TownRetentionState> : {};
        const hook = source.nextHook && typeof source.nextHook === "object" ? source.nextHook as Partial<TownRetentionHook> : {};
        return {
            streak: typeof source.streak === "number" && source.streak > 0 ? Math.floor(source.streak) : 0,
            lastQualifiedDay: typeof source.lastQualifiedDay === "number" ? Math.floor(source.lastQualifiedDay) : Math.max(0, day - 1),
            todayQualified: Boolean(source.todayQualified),
            nextHook: this.normalizeRetentionHook(hook, worldState, day),
        };
    }

    private normalizeRetentionHook(hook: Partial<TownRetentionHook>, worldState: TownWorldState, day: number): TownRetentionHook {
        const fallback = this.createNextHook(worldState, day);
        return {
            day: typeof hook.day === "number" ? hook.day : fallback.day,
            title: typeof hook.title === "string" && hook.title.trim() ? hook.title : fallback.title,
            desc: typeof hook.desc === "string" && hook.desc.trim() ? hook.desc : fallback.desc,
            action: this.isRetentionAction(hook.action) ? hook.action : fallback.action,
            target: typeof hook.target === "string" ? hook.target : fallback.target,
            targetLabel: typeof hook.targetLabel === "string" && hook.targetLabel.trim() ? hook.targetLabel : fallback.targetLabel,
            reason: typeof hook.reason === "string" && hook.reason.trim() ? hook.reason : fallback.reason,
        };
    }

    private isRetentionAction(action: unknown): action is TownRetentionHook["action"] {
        return typeof action === "string" && ["operate", "visit", "decorate", "explore", "upgrade", "chat", "rest"].includes(action);
    }

    private markRetentionQualified(save: TownSave, action: RetentionActionInput, progress: ProgressResult, characters: TownCharacter[] = []) {
        if (!this.isQualifiedRetentionAction(action)) return;
        const worldState = this.normalizeWorldState(save.worldState, save.day);
        const retention = this.normalizeRetentionState(worldState.retention, worldState, save.day);
        const completedCount = progress.completedTasks.length + (progress.completedWeeklyGoal ? 1 : 0) + (progress.questCompleted ? 1 : 0) + progress.achievements.length;
        worldState.retention = {
            ...retention,
            lastQualifiedDay: save.day,
            todayQualified: true,
            nextHook: this.createNextHook(worldState, save.day + 1, completedCount, characters),
        };
        save.worldState = worldState;
    }

    private advanceRetentionAfterRest(save: TownSave, characters: TownCharacter[] = []) {
        const worldState = this.normalizeWorldState(save.worldState, save.day);
        const retention = this.normalizeRetentionState(worldState.retention, worldState, save.day);
        const qualifiedDay = save.day - 1;
        const nextStreak = retention.todayQualified
            ? retention.lastQualifiedDay === qualifiedDay || retention.lastQualifiedDay === 0
                ? retention.streak + 1
                : 1
            : 0;
        worldState.retention = {
            streak: nextStreak,
            lastQualifiedDay: retention.todayQualified ? qualifiedDay : retention.lastQualifiedDay,
            todayQualified: false,
            nextHook: this.createNextHook(worldState, save.day, 0, characters),
        };
        save.worldState = worldState;
    }

    private isQualifiedRetentionAction(action: RetentionActionInput) {
        return ["operate", "visit", "decorate", "explore", "upgrade", "chat"].includes(action);
    }

    private createNextHook(worldState: TownWorldState, day: number, completedProgressCount = 0, characters: TownCharacter[] = []): TownRetentionHook {
        const memoryHook = this.createMemoryRetentionHook(day, characters);
        if (memoryHook) return memoryHook;
        const festival = worldState.activeFestival;
        if (festival && festival.status !== "completed") {
            return {
                day,
                title: `${festival.title}继续筹备`,
                desc: `${festival.desc} 还差 ${Math.max(0, festival.target - festival.progress)} 次关键行动。`,
                action: festival.action,
                target: this.getRetentionTargetForAction(festival.action),
                targetLabel: this.formatActionTargetLabel(festival.action),
                reason: "限时活动会把今天的行动延续成明天的目标。",
            };
        }
        const openTask = (worldState.dailyTasks ?? []).find((task) => !task.completed);
        if (openTask) {
            const action = this.mapTaskToRetentionAction(openTask.type);
            return {
                day,
                title: `下次先做：${openTask.title}`,
                desc: openTask.desc,
                action,
                target: this.getRetentionTargetForAction(action),
                targetLabel: this.formatActionTargetLabel(action),
                reason: "未完成任务会保留成下一次进入小镇的优先目标。",
            };
        }
        if (completedProgressCount >= 2) {
            return {
                day,
                title: "下次领取进阶路线",
                desc: "今天推进了多个目标，明天适合检查主线、升级建筑或探索新区。",
                action: "explore",
                target: "square",
                targetLabel: "中央广场",
                reason: "连续完成目标后，探索能把成长反馈转成新事件。",
            };
        }
        if (worldState.weather === "小雨") {
            return {
                day,
                title: "雨后居民邀约",
                desc: "小雨天气适合拜访居民，关系收益会更稳定。",
                action: "visit",
                target: "florist",
                targetLabel: "街角花店",
                reason: "天气变化让明日社交行动更有明确理由。",
            };
        }
        return {
            day,
            title: "下次开张计划",
            desc: "保持经营节奏，先做一项能补足资源或关系的行动。",
            action: worldState.reputation < 30 ? "visit" : "operate",
            target: worldState.reputation < 30 ? "florist" : "restaurant",
            targetLabel: worldState.reputation < 30 ? "街角花店" : "暖光餐馆",
            reason: "稳定的经营和关系会逐步解锁新区、章节与活动。",
        };
    }

    private createMemoryRetentionHook(day: number, characters: TownCharacter[]): TownRetentionHook | null {
        const character = characters.find((item) => (item.memory?.promises?.length ?? 0) > 0);
        if (!character) return null;
        const promise = character.memory?.promises?.[0];
        return {
            day,
            title: `下次回应${character.name}`,
            desc: promise ? `${character.name}还记着“${promise}”，拜访后可能触发记忆回响。` : `${character.name}把之前的对话记在心里，拜访后可能触发记忆回响。`,
            action: "visit",
            target: character.id,
            targetLabel: character.name,
            reason: "居民记忆把聊天内容延续到下一次行动，而不是只停留在文本里。",
        };
    }

    private mapTaskToRetentionAction(type: TownTask["type"]): TownRetentionHook["action"] {
        if (type === "earnCoins") return "operate";
        if (type === "gainReputation") return "visit";
        if (type === "chat") return "visit";
        return type;
    }

    private getRetentionTargetForAction(action: TownRetentionHook["action"]) {
        if (action === "operate") return "restaurant";
        if (action === "visit" || action === "decorate" || action === "chat") return "florist";
        if (action === "explore") return "square";
        return undefined;
    }

    private formatActionTargetLabel(action: TownRetentionHook["action"]) {
        if (action === "operate") return "暖光餐馆";
        if (action === "visit" || action === "chat") return "居民街角";
        if (action === "decorate") return "街角花店";
        if (action === "explore") return "中央广场";
        if (action === "upgrade") return "可升级建筑";
        return "小镇日程";
    }

    private createActionBudgetState(day: number, maxPerDay = 4): TownActionBudgetState {
        return { day, maxPerDay, usedActions: [] };
    }

    private normalizeActionBudgetState(budget: unknown, fallbackDay: number): TownActionBudgetState {
        if (!budget || typeof budget !== "object") {
            return this.createActionBudgetState(fallbackDay);
        }
        const source = budget as Partial<TownActionBudgetState> & { usedActions?: unknown };
        const usedActions = Array.isArray(source.usedActions)
            ? [...new Set(source.usedActions.filter((item): item is string => typeof item === "string"))]
            : [];
        const maxPerDay = typeof source.maxPerDay === "number" && source.maxPerDay > 0 ? source.maxPerDay : 4;
        const day = typeof source.day === "number" ? source.day : fallbackDay;
        const lastActionAt = typeof source.lastActionAt === "string" ? source.lastActionAt : undefined;
        if (day !== fallbackDay) {
            return this.createActionBudgetState(fallbackDay, maxPerDay);
        }
        return { day, maxPerDay, usedActions, lastActionAt };
    }

    private getActionBudgetState(save: TownSave): TownActionBudgetState {
        const worldState = this.normalizeWorldState(save.worldState, save.day);
        const budget = this.normalizeActionBudgetState(worldState.flags?.actionBudget, save.day);
        return budget.day === save.day ? budget : this.createActionBudgetState(save.day, budget.maxPerDay);
    }

    private setActionBudgetState(save: TownSave, budget: TownActionBudgetState) {
        const worldState = this.normalizeWorldState(save.worldState, save.day);
        save.worldState = {
            ...worldState,
            flags: {
                ...(worldState.flags ?? {}),
                actionBudget: budget,
            },
        };
    }

    private consumeActionBudget(save: TownSave, action: TownActionDto["action"]) {
        if (action === "advice" || action === "rest") {
            const budget = this.getActionBudgetState(save);
            this.setActionBudgetState(save, action === "rest" ? this.createActionBudgetState(save.day, budget.maxPerDay) : budget);
            return false;
        }

        const budget = this.getActionBudgetState(save);
        this.setActionBudgetState(save, {
            ...budget,
            usedActions: [...new Set([...budget.usedActions, action])],
            lastActionAt: new Date().toISOString(),
        });
        return !budget.usedActions.includes(action);
    }

    private getBuildingLevel(worldState: TownWorldState, buildingId: string) {
        return this.townWorldRulesService.getBuildingLevel(worldState, buildingId);
    }

    private getWeatherEffect(weather: string) {
        return this.townWorldRulesService.getWeatherEffect(weather);
    }

    private createDailySettlement(save: TownSave): TownSettlement {
        return this.townWorldRulesService.createDailySettlement(save, this.normalizeWorldState(save.worldState, save.day));
    }

    private applyAreaUnlocks(save: TownSave) {
        const worldState = this.normalizeWorldState(save.worldState, save.day);
        const result = this.townWorldRulesService.applyAreaUnlocks(worldState);
        save.worldState = result.worldState;
        return result.unlockedAreas;
    }

    private createActionConfig(action: TownActionDto["action"], save: TownSave, characters: TownCharacter[], choice?: TownEventChoice | null, buildingId?: string): ActionConfig {
        const worldState = this.normalizeWorldState(save.worldState, save.day);
        const restaurantLevel = this.getBuildingLevel(worldState, "restaurant");
        const floristLevel = this.getBuildingLevel(worldState, "florist");
        const squareLevel = this.getBuildingLevel(worldState, "square");
        const weatherEffect = this.getWeatherEffect(worldState.weather);
        if (action === "upgrade") {
            return this.createUpgradeConfig(save, characters, buildingId);
        }

        const context = {
            restaurantLevel,
            floristLevel,
            squareLevel,
            weather: worldState.weather,
            weatherEffect,
            suggestion: this.createSuggestion(save),
            mood: save.mood,
        };
        const catalogItem = TOWN_ACTION_CATALOG[action];
        const config: ActionConfig = {
            title: resolveTownActionCatalogValue(catalogItem.title, context),
            content: resolveTownActionCatalogValue(catalogItem.content, context),
            coins: resolveTownActionCatalogValue(catalogItem.coins ?? 0, context),
            stamina: resolveTownActionCatalogValue(catalogItem.stamina, context),
            reputation: resolveTownActionCatalogValue(catalogItem.reputation ?? 0, context),
            mood: resolveTownActionCatalogValue(catalogItem.mood, context),
            focus: catalogItem.focus,
        };

        return choice ? this.applyChoiceConfig(config, choice) : config;
    }

    private resolveChoice(dto: TownActionDto): TownEventChoice | null {
        if (!dto.choiceId) return null;
        const choice = this.createChoiceCatalog()[dto.choiceId];
        if (!choice) {
            throw new BadRequestException("小镇事件选项不存在");
        }
        return choice;
    }

    private createUpgradeConfig(save: TownSave, characters: TownCharacter[], buildingId?: string): ActionConfig {
        if (!buildingId) {
            throw new BadRequestException("请选择要升级的建筑");
        }
        const building = this.normalizeWorldState(save.worldState, save.day).buildings.find((item) => item.id === buildingId);
        if (!building) {
            throw new BadRequestException("小镇建筑不存在");
        }
        if (building.level >= 5) {
            throw new BadRequestException("该建筑已达到当前最高等级");
        }
        const discount = this.townRelationshipRulesService.getUpgradeDiscount(characters);
        const cost = Math.max(20, this.getBuildingUpgradeCost(building?.level ?? 1) - discount);
        return {
            title: `${building.name}升级`,
            content: `你召集居民一起翻新${building.name}。新的木牌挂上门口，来往的人都能看见这里正在变得更可靠。${discount ? `阿泽帮你压低了 ${discount} 金币成本。` : ""}`,
            coins: -cost,
            stamina: -12,
            reputation: 6,
            mood: "建设中",
            focus: "建筑升级",
            upgradedBuildingId: buildingId,
        };
    }

    private applyChoiceConfig(config: ActionConfig, choice: TownEventChoice): ActionConfig {
        const override = TOWN_CHOICE_ACTION_OVERRIDES[choice.id];
        if (!override) return config;
        return { ...config, ...override };
    }

    private async buildAiContext(userId: string, save: TownSave, manager?: EntityManager) {
        const characterRepository = manager?.getRepository(TownCharacter) ?? this.characterRepo;
        const eventRepository = manager?.getRepository(TownEvent) ?? this.eventRepo;
        const [characters, events] = await Promise.all([
            characterRepository.find({ where: { userId, saveId: save.id }, order: { relationship: "DESC" } }),
            eventRepository.find({ where: { userId, saveId: save.id }, order: { createdAt: "DESC" }, take: 8 }),
        ]);

        return { userId, save, characters, events };
    }

    private ensureActionAffordable(save: TownSave, action: TownActionDto["action"], config: ActionConfig) {
        const budget = this.getActionBudgetState(save);
        if (action !== "advice" && action !== "rest") {
            if (budget.usedActions.includes(action)) {
                throw new BadRequestException("今天已经做过这个行动了，换个行动或休息到明天");
            }
            if (budget.usedActions.length >= budget.maxPerDay) {
                throw new BadRequestException("今天的行动次数已用完，先休息到明天");
            }
        }

        if (action === "advice" || action === "rest") {
            return;
        }

        if (config.stamina < 0 && save.stamina + config.stamina < 0) {
            throw new BadRequestException("体力不足，先休息一天再继续行动");
        }

        if (config.coins < 0 && save.coins + config.coins < 0) {
            throw new BadRequestException("金币不足，先经营餐馆积累收入");
        }
    }

    private upgradeBuilding(worldState: TownWorldState, buildingId: string): TownWorldState {
        return this.townWorldRulesService.upgradeBuilding(this.normalizeWorldState(worldState), buildingId);
    }

    private getBuildingUpgradeCost(level: number) {
        return this.townWorldRulesService.getBuildingUpgradeCost(level);
    }

    private createDailyTasks(day: number): TownTask[] {
        return this.townProgressRulesService.createDailyTasks(day);
    }

    private getRelationshipLevel(value: number) {
        return this.townRelationshipRulesService.getRelationshipLevel(value);
    }

    private createWeeklyGoal(save?: TownSave): TownGoal {
        return this.townProgressRulesService.createWeeklyGoal(save?.day ?? 1);
    }

    private createMainQuest(chapter: number): TownQuestState {
        return this.townProgressRulesService.createMainQuest(chapter);
    }

    private applyProgress(save: TownSave, context: ProgressContext): ProgressResult {
        const worldState = this.normalizeWorldState(save.worldState, save.day);
        const result = this.townProgressRulesService.applyProgress(save, worldState, context, (state, buildingId) => this.getBuildingLevel(state, buildingId));
        save.worldState = worldState;
        return result;
    }

    private shouldRefreshWeeklyGoal(goal: TownGoal | null | undefined, day: number) {
        return this.townProgressRulesService.shouldRefreshWeeklyGoal(goal, day);
    }

    private applyResult(save: TownSave, result: TownEventResult, context: TownActionAuditContext): TownEventResult {
        const before = this.createResultSnapshot(save);
        save.coins = Math.max(0, save.coins + (result.coins ?? 0));
        save.stamina = Math.min(100, Math.max(0, save.stamina + (result.stamina ?? 0)));

        const worldState = this.normalizeWorldState(save.worldState, save.day);
        worldState.reputation = Math.max(0, worldState.reputation + (result.reputation ?? 0));
        save.worldState = worldState;

        if (worldState.reputation >= save.level * 18) {
            save.level += 1;
        }

        this.refreshResultAudit(save, result, context, before);
        return result;
    }

    private refreshResultAudit(save: TownSave, result: TownEventResult, context: TownActionAuditContext, before = result.audit?.before ?? this.createResultSnapshot(save)) {
        const after = this.createResultSnapshot(save);
        const ruleRefs = this.createResultRuleRefs(context);
        const notes = this.createResultNotes(result, context);
        result.audit = {
            before,
            after,
            deltas: {
                coins: after.coins - before.coins,
                stamina: after.stamina - before.stamina,
                reputation: after.reputation - before.reputation,
                level: after.level - before.level,
            },
            ruleRefs,
            source: context.source,
            action: {
                type: context.action,
                label: this.formatActionName(context.action),
                day: context.day,
                ...(context.choice ? { choiceId: context.choice.id, choiceLabel: context.choice.label } : {}),
                ...(context.building ? { buildingId: context.building.id, buildingName: context.building.name } : {}),
                ...(context.relationshipTarget ? { relationshipTargetId: context.relationshipTarget.id, relationshipTargetName: context.relationshipTarget.name } : {}),
            },
            budget: this.createResultBudgetAudit(context),
            resourceBreakdown: this.createResourceBreakdown(result, context),
            model: {
                assisted: Boolean(context.modelAssisted),
                fallbackUsed: Boolean(context.fallbackUsed),
            },
            notes,
        };
    }

    private createResultSnapshot(save: TownSave) {
        return {
            coins: save.coins,
            stamina: save.stamina,
            reputation: this.normalizeWorldState(save.worldState, save.day).reputation,
            level: save.level,
        };
    }

    private createResultRuleRefs(context: TownActionAuditContext) {
        const refs = [`action:${context.action}`, "rule:resource-delta"];
        if (context.settlement) refs.push("rule:daily-settlement", "rule:building-income", "rule:building-maintenance");
        if (context.action === "upgrade") refs.push("rule:building-upgrade");
        if (context.action === "advice") refs.push("rule:strategy-advice");
        if (context.choice) refs.push(`choice:${context.choice.id}`);
        if (context.building) refs.push(`building:${context.building.id}`);
        if (context.relationshipTarget) refs.push("rule:relationship-target");
        if (context.budgetConsumed) refs.push("rule:daily-action-budget");
        if (context.modelAssisted) refs.push(context.fallbackUsed ? "model:fallback" : "model:assisted");
        return refs;
    }

    private createResultNotes(result: TownEventResult, context: TownActionAuditContext) {
        const notes: string[] = [];
        if (typeof result.coins === "number" && result.coins !== 0) notes.push(`金币 ${result.coins > 0 ? "+" : ""}${result.coins}`);
        if (typeof result.stamina === "number" && result.stamina !== 0) notes.push(`体力 ${result.stamina > 0 ? "+" : ""}${result.stamina}`);
        if (typeof result.reputation === "number" && result.reputation !== 0) notes.push(`声望 ${result.reputation > 0 ? "+" : ""}${result.reputation}`);
        if (context.settlement) notes.push(`日结收入 +${context.settlement.income}，维护 -${context.settlement.maintenance}`);
        if (context.bonuses?.length) notes.push(`关系收益：${context.bonuses.join("、")}`);
        if (context.choice) notes.push(`选择：${context.choice.label}`);
        if (context.building) notes.push(`建筑：${context.building.name}`);
        if (context.relationshipTarget) notes.push(`关系目标：${context.relationshipTarget.name}`);
        if (context.budgetConsumed && context.budgetAfter) notes.push(`今日行动剩余 ${Math.max(0, context.budgetAfter.maxPerDay - context.budgetAfter.usedActions.length)}`);
        if (context.modelAssisted) notes.push(context.fallbackUsed ? "参谋使用本地规则补位" : "参谋生成了事件内容");
        if (!notes.length) notes.push(context.action === "advice" ? "今日计划已更新" : "小镇状态已记录");
        return notes;
    }

    private createResultBudgetAudit(context: TownActionAuditContext): NonNullable<NonNullable<TownEventResult["audit"]>["budget"]> | undefined {
        const before = context.budgetBefore;
        const after = context.budgetAfter ?? before;
        if (!before || !after) return undefined;
        return {
            maxPerDay: after.maxPerDay,
            usedBefore: before.usedActions.length,
            usedAfter: after.usedActions.length,
            consumed: Boolean(context.budgetConsumed),
            remaining: Math.max(0, after.maxPerDay - after.usedActions.length),
        };
    }

    private createResourceBreakdown(result: TownEventResult, context: TownActionAuditContext): NonNullable<NonNullable<TownEventResult["audit"]>["resourceBreakdown"]> {
        const breakdown: NonNullable<NonNullable<TownEventResult["audit"]>["resourceBreakdown"]> = [];
        if (typeof result.coins === "number" && result.coins !== 0) {
            breakdown.push({ label: "行动金币", value: result.coins, detail: this.formatActionName(context.action) });
        }
        if (typeof result.stamina === "number" && result.stamina !== 0) {
            breakdown.push({ label: "体力变化", value: result.stamina, detail: this.formatActionName(context.action) });
        }
        if (typeof result.reputation === "number" && result.reputation !== 0) {
            breakdown.push({ label: "声望变化", value: result.reputation, detail: this.formatActionName(context.action) });
        }
        if (context.settlement?.breakdown?.length) {
            breakdown.push(...context.settlement.breakdown.map((item) => ({ label: item.label, value: item.value, detail: item.detail })));
        }
        if (context.bonuses?.length) {
            breakdown.push(...context.bonuses.map((bonus) => ({ label: "关系收益", value: 0, detail: bonus })));
        }
        return breakdown;
    }

    private getAuditBuilding(save: TownSave, buildingId?: string) {
        if (!buildingId) return null;
        const building = this.normalizeWorldState(save.worldState, save.day).buildings.find((item) => item.id === buildingId);
        return building ? { id: building.id, name: building.name } : null;
    }

    private async pickRelationshipTarget(userId: string, save: TownSave, action: string, manager?: EntityManager) {
        if (!["visit", "chat", "explore", "decorate"].includes(action)) return null;
        const characterRepository = manager?.getRepository(TownCharacter) ?? this.characterRepo;
        const characters = await characterRepository.find({ where: { userId, saveId: save.id }, order: { relationship: "ASC" } });
        return this.townRelationshipRulesService.pickTarget(characters, save, action);
    }

    private getRelationshipDelta(action: string) {
        return this.townRelationshipRulesService.getRelationshipDelta(action);
    }

    private getRelationshipBonuses(characters: TownCharacter[], action: TownActionDto["action"]): RelationshipBonus[] {
        if (action === "upgrade") {
            const discount = this.townRelationshipRulesService.getUpgradeDiscount(characters);
            return discount ? [{ key: "aze-upgrade", label: "阿泽账本", desc: `阿泽帮你核对采购单，升级费用 -${discount} 金币。`, discount }] : [];
        }
        return this.townRelationshipRulesService.getRelationshipBonuses(characters, action);
    }

    private applyRelationshipBonuses(config: ActionConfig, bonuses: RelationshipBonus[]): ActionConfig {
        if (!bonuses.length) return config;
        const coins = bonuses.reduce((total, bonus) => total + (bonus.coins ?? 0), config.coins);
        const stamina = bonuses.reduce((total, bonus) => total + (bonus.stamina ?? 0), config.stamina);
        const reputation = bonuses.reduce((total, bonus) => total + (bonus.reputation ?? 0), config.reputation);
        return {
            ...config,
            coins,
            stamina,
            reputation,
            content: `${config.content}\n${bonuses.map((bonus) => bonus.desc).join(" ")}`,
        };
    }

    private async applyRelationshipResult(manager: EntityManager, userId: string, saveId: string, result: TownEventResult, preferredTarget: TownCharacter | null, action: TownActionDto["action"], day: number): Promise<TownEvent[]> {
        const entries = Object.entries(result.relationship ?? {});
        const updates: RelationshipUpdate[] = [];
        const memoryEvents: TownEvent[] = [];
        for (const [characterId, delta] of entries) {
            if (!delta) continue;
            const character = preferredTarget?.id === characterId ? preferredTarget : await manager.findOne(TownCharacter, { where: { id: characterId, userId, saveId } });
            if (!character) continue;
            const update = this.townRelationshipRulesService.applyCharacterRelationship(character, delta, action);
            const promiseEvent = this.createPromiseReminderEvent(userId, saveId, character, action, day);
            await manager.save(TownCharacter, character);
            updates.push(update);
            if (promiseEvent) memoryEvents.push(promiseEvent);
        }
        const relationshipEvents = updates.flatMap((update) => {
            const story = this.createNpcStoryEvent(userId, saveId, update.character, action, update.delta);
            return update.oldLevel === update.newLevel ? [] : [story, this.createRelationshipLevelEvent(userId, saveId, update.character, update.oldLevel, update.newLevel, update.delta)];
        });
        return [...memoryEvents, ...relationshipEvents];
    }

    private createPromiseReminderEvent(userId: string, saveId: string, character: TownCharacter, action: TownActionDto["action"], day: number): TownEvent | null {
        if (!["visit", "chat", "decorate", "explore"].includes(action)) return null;
        const promises = Array.isArray(character.memory?.promises) ? character.memory.promises : [];
        const promise = promises[0];
        if (!promise) return null;
        character.relationship = Math.min(100, character.relationship + 1);
        character.memory = {
            ...(character.memory ?? {}),
            relationshipLevel: this.getRelationshipLevel(character.relationship),
            promises: promises.slice(1),
            keyMoments: this.mergeLimitedMoments(character.memory?.keyMoments, [{
                day,
                title: `${character.name}想起约定`,
                summary: promise,
            }], 5),
        };
        return this.eventRepo.create({
            userId,
            saveId,
            type: "memory_promise",
            title: `${character.name}想起约定`,
            content: `${character.name}还记得你们之前聊过的“${promise}”。这次${this.formatActionName(action)}让这段约定重新浮上心头。`,
            choices: this.createNextChoices(action === "explore" ? "explore" : "visit"),
            result: {
                relationship: { [character.id]: 1 },
                audit: {
                    before: { coins: 0, stamina: 0, reputation: 0, level: 0 },
                    after: { coins: 0, stamina: 0, reputation: 0, level: 0 },
                    deltas: { coins: 0, stamina: 0, reputation: 0, level: 0 },
                    ruleRefs: ["rule:npc-memory", `action:${action}`],
                    source: "rules",
                    action: {
                        type: action,
                        label: this.formatActionName(action),
                        day,
                        relationshipTargetId: character.id,
                        relationshipTargetName: character.name,
                    },
                    resourceBreakdown: [{ label: "记忆约定", value: 0, detail: `${character.name}兑现记忆约定` }],
                    model: { assisted: false, fallbackUsed: false },
                    notes: [`${character.name}兑现记忆约定`, "关系 +1"],
                },
            },
        });
    }

    private formatActionName(action: TownActionDto["action"]) {
        const labels: Record<string, string> = { operate: "经营餐馆", visit: "拜访居民", decorate: "布置小镇", explore: "探索街区", rest: "休息", advice: "规划经营", upgrade: "升级建筑" };
        return labels[action] ?? action;
    }

    private createRelationshipLevelEvent(userId: string, saveId: string, character: TownCharacter, oldLevel: string, newLevel: string, delta: number) {
        return this.townRelationshipRulesService.createRelationshipLevelEvent((params) => this.eventRepo.create(params), userId, saveId, character, oldLevel, newLevel, delta, this.createNextChoices("visit"));
    }

    private createNpcStoryEvent(userId: string, saveId: string, character: TownCharacter, action: TownActionDto["action"], delta: number) {
        return this.townRelationshipRulesService.createNpcStoryEvent((params) => this.eventRepo.create(params), userId, saveId, character, action, delta, this.createNextChoices(action === "explore" ? "explore" : "visit"));
    }

    private createActivityEvents(userId: string, saveId: string, save: TownSave, action: TownActionDto["action"]): TownEvent[] {
        const worldState = this.normalizeWorldState(save.worldState, save.day);
        const result = this.townWorldRulesService.advanceFestival(worldState, save, action);
        save.worldState = result.worldState;
        if (!result.event) return [];
        const event = result.event;
        if (result.completed) {
            const reward = result.completed.reward;
            save.coins = Math.max(0, save.coins + (reward.coins ?? 0));
            save.stamina = Math.min(100, Math.max(0, save.stamina + (reward.stamina ?? 0)));
            return [this.eventRepo.create({ userId, saveId, type: "festival", title: `活动完成：${event.title}`, content: `${event.title}正式开始。${this.formatFestivalReward(event)}`, choices: this.createNextChoices(action), result: { coins: reward.coins, stamina: reward.stamina, reputation: reward.reputation, relationship: reward.relationship } })];
        }
        const statusCopy = event.status === "ready" ? "进入最后筹备" : event.status === "preparing" ? "筹备推进" : "活动预告";
        return [this.eventRepo.create({ userId, saveId, type: "festival", title: `${statusCopy}：${event.title}`, content: `${event.desc} 当前进度 ${event.progress}/${event.target}，剩余 ${event.daysLeft} 天。`, choices: this.createNextChoices(action), result: null })];
    }

    private formatFestivalReward(event: TownFestivalState) {
        const reward = event.reward;
        const parts = [
            reward.coins ? `金币 +${reward.coins}` : null,
            reward.stamina ? `体力 +${reward.stamina}` : null,
            reward.reputation ? `声望 +${reward.reputation}` : null,
            reward.unlockArea ? `解锁 ${reward.unlockArea}` : null,
        ].filter(Boolean);
        return parts.length ? `活动奖励：${parts.join("，")}。` : "居民把这一天写进了小镇日志。";
    }

    private createNextChoices(action: TownActionDto["action"]) {
        if (action === "advice") {
            return null;
        }

        const catalog = this.createChoiceCatalog();
        if (action === "explore") {
            return [catalog.explore, catalog.visit, catalog.operate];
        }
        if (action === "rest") {
            return [catalog.operate, catalog.visit, catalog.explore];
        }
        return [catalog.operate, catalog.visit, catalog.rest];
    }

    private createChoiceCatalog(): Record<string, TownEventChoice> {
        return createTownChoiceCatalog();
    }

    private createSuggestion(save: TownSave) {
        const worldState = this.normalizeWorldState(save.worldState, save.day);
        if (save.stamina < 30) {
            return "今日计划：今天先降低经营强度，安排一次居民晚餐或休息。体力恢复后，再用花店和餐馆联动活动提高声望。";
        }
        if (save.coins < 60) {
            return "今日计划：优先经营暖光餐馆，选择高性价比菜单积累金币。金币回到 100 以上后，再升级广场装饰。";
        }
        if (worldState.reputation < save.level * 12) {
            return "今日计划：多拜访居民并触发街区事件。关系值提升后，居民会提供更稳定的经营线索。";
        }
        return "今日计划：今天适合探索新街区或筹备灯会。你的小镇资源充足，可以把经营目标从赚钱转向扩大声望。";
    }

    private createNpcReply(character: TownCharacter, message: string) {
        const shortMessage = message.trim().slice(0, 60);
        const replies: Record<string, string> = {
            "餐馆帮手": `小满听完“${shortMessage}”后点点头：我可以先去准备食材！如果今天客人很多，我们就把招牌菜做成套餐吧。`,
            "餐馆老板": `阿泽把账本合上：你的想法不错。“${shortMessage}”这件事可以分两步做，先保住现金流，再安排居民活动。`,
            "花店店主": `花音笑着递来一束小花：我喜欢这个方向。也许可以把“${shortMessage}”变成明天公告板上的温柔邀请。`,
            "神秘旅人": `旅人洛看向远处的屋顶：我在别的小镇也听过类似传闻。关于“${shortMessage}”，夜晚的广场可能会给你答案。`,
        };

        return replies[character.role] ?? `${character.name}认真听完后说：这会成为小镇今天的小小转机。`;
    }
}
