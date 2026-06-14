import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { Brackets, EntityManager, Repository } from "@buildingai/db/typeorm";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { TownCharacter, TownEvent, TownSave, type TownEventChoice, type TownEventResult, type TownWorldState } from "../../../db/entities";
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

type TownSettlement = NonNullable<TownWorldState["lastSettlement"]>;
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
        const save = await this.ensureSaveOwner(userId, saveId);
        const characters = await this.characterRepo.find({ where: { userId, saveId }, order: { relationship: "DESC" } });
        const bonuses = this.getRelationshipBonuses(characters, dto.action);
        const choice = this.resolveChoice(dto);
        const config = this.applyRelationshipBonuses(this.createActionConfig(dto.action, save, characters, choice, dto.buildingId), bonuses);
        this.ensureActionAffordable(save, dto.action, config);
        const settlement = dto.action === "rest" ? this.createDailySettlement(save) : null;
        const result = this.applyResult(save, {
            coins: config.coins,
            stamina: config.stamina,
            reputation: config.reputation + (settlement?.reputation ?? 0),
        });
        if (bonuses.length) {
            result.bonuses = bonuses.map((bonus) => bonus.label);
        }
        if (settlement) {
            result.coins = (result.coins ?? 0) + settlement.income - settlement.maintenance;
            save.coins = Math.max(0, save.coins + settlement.income - settlement.maintenance);
        }

        save.day += dto.action === "rest" ? 1 : 0;
        save.mood = config.mood;
        save.worldState = { ...this.normalizeWorldState(save.worldState), focus: config.focus };
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
        });
        const unlockedAreas = this.applyAreaUnlocks(save);
        const relationshipTarget = await this.pickRelationshipTarget(userId, save, choice?.id ?? dto.action);
        if (relationshipTarget) {
            result.relationship = { [relationshipTarget.id]: this.getRelationshipDelta(choice?.id ?? dto.action) };
        }

        const aiContext = dto.action === "advice" || dto.action === "explore" ? { ...(await this.buildAiContext(userId, save)), choice } : null;
        let eventTitle = config.title;
        let eventChoices = this.createNextChoices(dto.action);
        const content = dto.action === "advice"
            ? await this.townAiService.generateStrategy(aiContext!, config.content).then((advice) => {
                result.strategy = advice.strategy;
                if (advice.fallbackUsed) {
                    result.fallbackUsed = true;
                }
                return advice.strategy.summary;
            })
            : dto.action === "explore"
                ? await this.townAiService.generateStructuredEvent(aiContext!, config.content).then((event) => {
                    eventTitle = event.title || eventTitle;
                    eventChoices = event.choices ?? eventChoices;
                    if (event.fallbackUsed) {
                        result.fallbackUsed = true;
                    }
                    return event.content;
                })
                : settlement
                    ? `${config.content}\n${settlement.summary}`
                    : config.content;
        const activityEvents = this.createActivityEvents(userId, saveId, save, dto.action);

        await this.saveRepo.manager.transaction(async (manager) => {
            await manager.save(TownSave, save);
            const relationshipEvents = await this.applyRelationshipResult(manager, userId, saveId, result, relationshipTarget, dto.action);
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

    async chat(userId: string, saveId: string, dto: TownChatDto) {
        const save = await this.ensureSaveOwner(userId, saveId);
        const character = await this.characterRepo.findOne({ where: { id: dto.characterId, userId, saveId } });
        if (!character) {
            throw new NotFoundException("小镇居民不存在");
        }

        const fallbackReply = this.createNpcReply(character, dto.message);
        const reply = await this.townAiService.generateNpcReply(
            {
                ...(await this.buildAiContext(userId, save)),
                character,
                message: dto.message,
            },
            fallbackReply,
        );
        const oldLevel = this.getRelationshipLevel(character.relationship);
        character.relationship = Math.min(100, character.relationship + 3);
        const newLevel = this.getRelationshipLevel(character.relationship);
        character.status = "刚聊过天";
        const recentMessages = Array.isArray(character.memory?.recentMessages) ? character.memory.recentMessages.slice(-4) : [];
        character.memory = {
            ...(character.memory ?? {}),
            lastMessage: dto.message,
            lastReply: reply,
            relationshipLevel: this.getRelationshipLevel(character.relationship),
            summary: `${character.name}记得你聊过“${dto.message.trim().slice(0, 24)}”。`,
            recentMessages: [...recentMessages, { user: dto.message, reply, at: new Date().toISOString() }],
        };

        const progress = this.applyProgress(save, { action: "chat" });

        await this.saveRepo.manager.transaction(async (manager) => {
            await manager.save(TownCharacter, character);
            await manager.save(TownSave, save);
            await manager.save(
                TownEvent,
                this.eventRepo.create({
                    userId,
                    saveId,
                    type: "chat",
                    title: `和${character.name}聊天`,
                    content: reply,
                    choices: null,
                    result: { relationship: { [character.id]: 3 } },
                }),
            );
            const progressEvents = this.createProgressEvents(userId, saveId, progress, "visit");
            if (progressEvents.length) {
                await manager.save(TownEvent, progressEvents);
            }
            if (oldLevel !== newLevel) {
                await manager.save(TownEvent, this.createRelationshipLevelEvent(userId, saveId, character, oldLevel, newLevel, 3));
            }
        });

        return { character, reply, save: await this.getSaveDetail(userId, saveId) };
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

    private hydrateSave(save: TownSave): TownSaveDetail {
        const events = [...(save.events ?? [])].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 20);
        const characters = [...(save.characters ?? [])].sort((a, b) => b.relationship - a.relationship);

        return {
            ...save,
            worldState: this.normalizeWorldState(save.worldState),
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
            unlockedAreas: ["中央广场", "暖光餐馆", "花店街角"],
            buildings: [
                { id: "restaurant", name: "暖光餐馆", level: 1, status: "可经营", effect: "提高经营收入", maxLevel: 5 },
                { id: "florist", name: "风铃花店", level: 1, status: "可拜访", effect: "提高拜访与装饰声望", maxLevel: 5 },
                { id: "square", name: "中央广场", level: 1, status: "可探索", effect: "提高探索奖励", maxLevel: 5 },
            ],
            flags: {},
            dailyTasks: this.createDailyTasks(1),
            weeklyGoal: this.createWeeklyGoal(),
            mainQuest: this.createMainQuest(1),
            achievements: [],
            activeFestival: null,
            lastSettlement: null,
        };
    }

    private createDefaultCharacters(userId: string, saveId: string): TownCharacter[] {
        return [
            this.characterRepo.create({ userId, saveId, name: "小满", role: "餐馆帮手", personality: "乐观、勤快，喜欢尝试新菜谱", relationship: 32, status: "准备午餐", memory: {} }),
            this.characterRepo.create({ userId, saveId, name: "阿泽", role: "餐馆老板", personality: "可靠、热情，擅长规划经营", relationship: 28, status: "清点库存", memory: {} }),
            this.characterRepo.create({ userId, saveId, name: "花音", role: "花店店主", personality: "温柔、细致，熟悉居民喜好", relationship: 24, status: "整理花束", memory: {} }),
            this.characterRepo.create({ userId, saveId, name: "旅人洛", role: "神秘旅人", personality: "友善、神秘，带来远方传闻", relationship: 18, status: "路过广场", memory: {} }),
        ];
    }

    private normalizeWorldState(worldState?: TownWorldState | null): TownWorldState {
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
        return nextWorldState;
    }

    private getBuildingLevel(worldState: TownWorldState, buildingId: string) {
        return this.townWorldRulesService.getBuildingLevel(worldState, buildingId);
    }

    private getWeatherEffect(weather: string) {
        return this.townWorldRulesService.getWeatherEffect(weather);
    }

    private createDailySettlement(save: TownSave): TownSettlement {
        return this.townWorldRulesService.createDailySettlement(save, this.normalizeWorldState(save.worldState));
    }

    private applyAreaUnlocks(save: TownSave) {
        const worldState = this.normalizeWorldState(save.worldState);
        const result = this.townWorldRulesService.applyAreaUnlocks(worldState);
        save.worldState = result.worldState;
        return result.unlockedAreas;
    }

    private createActionConfig(action: TownActionDto["action"], save: TownSave, characters: TownCharacter[], choice?: TownEventChoice | null, buildingId?: string): ActionConfig {
        const worldState = this.normalizeWorldState(save.worldState);
        const restaurantLevel = this.getBuildingLevel(worldState, "restaurant");
        const floristLevel = this.getBuildingLevel(worldState, "florist");
        const squareLevel = this.getBuildingLevel(worldState, "square");
        const weatherEffect = this.getWeatherEffect(worldState.weather);
        if (action === "upgrade") {
            return this.createUpgradeConfig(save, characters, buildingId);
        }

        const configs: Record<Exclude<TownActionDto["action"], "upgrade">, ActionConfig> = {
            operate: {
                title: "暖光餐馆开张",
                content: "你把今日菜单改成番茄炖菜和烤面包。午后雨停时，几位居民排队进店，小满记下了大家最喜欢的口味。",
                coins: Math.round((32 + restaurantLevel * 8) * weatherEffect.operateCoins),
                stamina: -18,
                reputation: 3,
                mood: "充实",
                focus: "餐馆经营",
            },
            visit: {
                title: "街角拜访",
                content: "你带着新鲜点心去花店街角串门。花音建议在广场摆一张留言桌，让居民写下明天想参加的活动。",
                coins: -6,
                stamina: -10,
                reputation: 3 + floristLevel + weatherEffect.visitReputation,
                mood: "亲近",
                focus: "居民关系",
            },
            decorate: {
                title: "小镇布置日",
                content: "你把旧木箱改成花架，又在门口挂上暖黄色小灯。夜幕降临时，路过的居民都停下来看了一会儿。",
                coins: -24,
                stamina: -14,
                reputation: 4 + floristLevel,
                mood: "焕新",
                focus: "街区美化",
            },
            explore: {
                title: `${worldState.weather}街区探索`,
                content: "你沿着石板路走到还没修好的旧喷泉旁，发现一张被雨水打湿的活动清单：周末也许可以办一场小型灯会。",
                coins: 8 + squareLevel * 4,
                stamina: -16 - weatherEffect.exploreStaminaCost,
                reputation: 1 + squareLevel + weatherEffect.exploreReputation,
                mood: "好奇",
                focus: "开放探索",
            },
            rest: {
                title: "休息一晚",
                content: "你提前关店，和居民们一起在厨房喝热汤。第二天清晨，小镇恢复了元气，新的机会也在公告板上出现。",
                coins: 0,
                stamina: 42,
                reputation: Math.round(1 * weatherEffect.reputationMultiplier),
                mood: "治愈",
                focus: "恢复体力",
            },
            advice: {
                title: "AI 经营建议",
                content: this.createSuggestion(save),
                coins: 0,
                stamina: 0,
                reputation: 0,
                mood: save.mood,
                focus: "经营规划",
            },
        };

        return choice ? this.applyChoiceConfig(configs[action], choice) : configs[action];
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
        const building = this.normalizeWorldState(save.worldState).buildings.find((item) => item.id === buildingId);
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
        const choiceConfigs: Record<string, Partial<ActionConfig>> = {
            operate: {
                title: "选项推进：继续经营",
                content: "你顺着上一条线索回到餐馆，把今日菜单改成更稳妥的套餐。熟客们很快坐满靠窗的位置，账本上的现金流重新变得安心。",
                coins: 42,
                stamina: -20,
                reputation: 3,
                mood: "笃定",
                focus: "稳定经营",
            },
            visit: {
                title: "选项推进：找居民聊聊",
                content: "你带着刚得到的线索拜访居民。大家围在公告板前补充细节，一场小型街角活动慢慢有了雏形。",
                coins: -4,
                stamina: -10,
                reputation: 6,
                mood: "亲近",
                focus: "居民协作",
            },
            explore: {
                title: "选项推进：继续探索",
                content: "你沿着线索继续往旧街区深处走去，在墙角发现一枚写着日期的木牌，也许明天这里会出现新的访客。",
                coins: 14,
                stamina: -18,
                reputation: 3,
                mood: "好奇",
                focus: "线索探索",
            },
            rest: {
                title: "选项推进：休息一天",
                content: "你把今天的发现写进小镇日志，然后早早休息。第二天醒来时，门缝下多了一张居民留下的小纸条。",
                coins: 0,
                stamina: 48,
                reputation: 1,
                mood: "治愈",
                focus: "恢复体力",
            },
        };

        const override = choiceConfigs[choice.id];
        if (!override) return config;
        return { ...config, ...override };
    }

    private async buildAiContext(userId: string, save: TownSave) {
        const [characters, events] = await Promise.all([
            this.characterRepo.find({ where: { userId, saveId: save.id }, order: { relationship: "DESC" } }),
            this.eventRepo.find({ where: { userId, saveId: save.id }, order: { createdAt: "DESC" }, take: 8 }),
        ]);

        return { userId, save, characters, events };
    }

    private ensureActionAffordable(save: TownSave, action: TownActionDto["action"], config: ActionConfig) {
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
        const worldState = this.normalizeWorldState(save.worldState);
        const result = this.townProgressRulesService.applyProgress(save, worldState, context, (state, buildingId) => this.getBuildingLevel(state, buildingId));
        save.worldState = worldState;
        return result;
    }

    private shouldRefreshWeeklyGoal(goal: TownGoal | null | undefined, day: number) {
        return this.townProgressRulesService.shouldRefreshWeeklyGoal(goal, day);
    }

    private applyResult(save: TownSave, result: TownEventResult): TownEventResult {
        save.coins = Math.max(0, save.coins + (result.coins ?? 0));
        save.stamina = Math.min(100, Math.max(0, save.stamina + (result.stamina ?? 0)));

        const worldState = this.normalizeWorldState(save.worldState);
        worldState.reputation = Math.max(0, worldState.reputation + (result.reputation ?? 0));
        save.worldState = worldState;

        if (worldState.reputation >= save.level * 18) {
            save.level += 1;
        }

        return result;
    }

    private async pickRelationshipTarget(userId: string, save: TownSave, action: string) {
        if (!["visit", "chat", "explore", "decorate"].includes(action)) return null;
        const characters = await this.characterRepo.find({ where: { userId, saveId: save.id }, order: { relationship: "ASC" } });
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

    private async applyRelationshipResult(manager: EntityManager, userId: string, saveId: string, result: TownEventResult, preferredTarget: TownCharacter | null, action: TownActionDto["action"]): Promise<TownEvent[]> {
        const entries = Object.entries(result.relationship ?? {});
        const updates: RelationshipUpdate[] = [];
        for (const [characterId, delta] of entries) {
            if (!delta) continue;
            const character = preferredTarget?.id === characterId ? preferredTarget : await manager.findOne(TownCharacter, { where: { id: characterId, userId, saveId } });
            if (!character) continue;
            const update = this.townRelationshipRulesService.applyCharacterRelationship(character, delta, action);
            await manager.save(TownCharacter, character);
            updates.push(update);
        }
        return updates.flatMap((update) => {
            const story = this.createNpcStoryEvent(userId, saveId, update.character, action, update.delta);
            return update.oldLevel === update.newLevel ? [] : [story, this.createRelationshipLevelEvent(userId, saveId, update.character, update.oldLevel, update.newLevel, update.delta)];
        });
    }

    private createRelationshipLevelEvent(userId: string, saveId: string, character: TownCharacter, oldLevel: string, newLevel: string, delta: number) {
        return this.townRelationshipRulesService.createRelationshipLevelEvent((params) => this.eventRepo.create(params), userId, saveId, character, oldLevel, newLevel, delta, this.createNextChoices("visit"));
    }

    private createNpcStoryEvent(userId: string, saveId: string, character: TownCharacter, action: TownActionDto["action"], delta: number) {
        return this.townRelationshipRulesService.createNpcStoryEvent((params) => this.eventRepo.create(params), userId, saveId, character, action, delta, this.createNextChoices(action === "explore" ? "explore" : "visit"));
    }

    private createActivityEvents(userId: string, saveId: string, save: TownSave, action: TownActionDto["action"]): TownEvent[] {
        const worldState = this.normalizeWorldState(save.worldState);
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
        return {
            operate: { id: "operate", label: "继续经营", hint: "稳定赚取金币" },
            visit: { id: "visit", label: "找居民聊聊", hint: "提升小镇氛围" },
            explore: { id: "explore", label: "追踪线索", hint: "发现新的街区事件" },
            rest: { id: "rest", label: "休息一天", hint: "恢复体力并推进日期" },
        };
    }

    private createSuggestion(save: TownSave) {
        const worldState = this.normalizeWorldState(save.worldState);
        if (save.stamina < 30) {
            return "AI 建议：今天先降低经营强度，安排一次居民晚餐或休息。体力恢复后，再用花店和餐馆联动活动提高声望。";
        }
        if (save.coins < 60) {
            return "AI 建议：优先经营暖光餐馆，选择高性价比菜单积累金币。金币回到 100 以上后，再升级广场装饰。";
        }
        if (worldState.reputation < save.level * 12) {
            return "AI 建议：多拜访居民并触发街区事件。关系值提升后，NPC 会提供更稳定的经营线索。";
        }
        return "AI 建议：今天适合探索新街区或筹备灯会。你的小镇资源充足，可以把经营目标从赚钱转向扩大声望。";
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
