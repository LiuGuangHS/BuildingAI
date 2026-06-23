import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { MoreThanOrEqual, Repository } from "@buildingai/db/typeorm";
import { PublicAiModelService, safeJsonParse } from "@buildingai/extension-sdk";
import { Injectable, Logger } from "@nestjs/common";

import { TownAiCallLog, TownAiConfig, TownCharacter, TownEvent, TownSave } from "../../../db/entities";
import { type UpdateTownAiConfigDto } from "../dto";
import {
    TOWN_AI_CONFIG_KEY,
    TOWN_AI_DEFAULT_CONFIG,
    getTownAiDayStart,
    hasTownAiDailyLimitReached,
    shouldUseTownAiDailyLimit,
} from "./town-ai-rules.mjs";

type GenerateContext = {
    userId?: string;
    save?: TownSave;
    characters?: TownCharacter[];
    events?: TownEvent[];
    choice?: {
        id: string;
        label: string;
        hint: string;
    } | null;
};

type AiTownEventDraft = {
    title: string;
    content: string;
    choices: Array<{ label: string; hint: string; intent: "operate" | "visit" | "explore" | "rest" }>;
    tags?: string[];
    buildingId?: string;
    characterRole?: string;
};

export type TownAiBillingContext = {
    amount: number;
    label: string;
    fallbackUsed: boolean;
};

type TownAiTextResult = {
    text: string;
    billing: TownAiBillingContext;
};

export type AiTownStrategyDraft = {
    summary: string;
    action: string;
    target: string;
    reason: string;
    risk: string;
    expected: string;
    nextStep: string;
};

@Injectable()
export class TownAiService {
    private readonly logger = new Logger(TownAiService.name);
    private readonly configRepo: Repository<TownAiConfig>;
    private readonly callLogRepo: Repository<TownAiCallLog>;
    private readonly aiModelService: PublicAiModelService;

    constructor(
        @InjectRepository(TownAiConfig)
        configRepo: Repository<TownAiConfig>,
        @InjectRepository(TownAiCallLog)
        callLogRepo: Repository<TownAiCallLog>,
        aiModelService: PublicAiModelService,
    ) {
        this.configRepo = configRepo;
        this.callLogRepo = callLogRepo;
        this.aiModelService = aiModelService;
    }

    async getConfig() {
        const config = await this.configRepo.findOne({ where: { key: TOWN_AI_CONFIG_KEY } });
        if (config) return config;
        try {
            return await this.configRepo.save(this.createDefaultConfig());
        } catch (error) {
            if ((error as { code?: string }).code !== "23505") throw error;
            const racedConfig = await this.configRepo.findOne({ where: { key: TOWN_AI_CONFIG_KEY } });
            if (racedConfig) return racedConfig;
            throw error;
        }
    }

    async updateConfig(dto: UpdateTownAiConfigDto) {
        const current = await this.getConfig();
        const defaultModelId = dto.defaultModelId === "" ? null : dto.defaultModelId;
        if (defaultModelId) await this.loadLlmModel(defaultModelId);
        const next = this.configRepo.create({
            ...current,
            ...dto,
            defaultModelId,
        });
        return this.configRepo.save(next);
    }

    async listAvailableModels() {
        const models = await this.aiModelService.listActiveLlmModels();
        return models
            .filter((model) => model.provider?.isActive)
            .map((model) => ({
                id: model.id,
                name: model.name,
                model: model.model,
                modelType: model.modelType,
                providerId: model.providerId,
                providerName: model.provider.name,
                provider: model.provider.provider,
                description: model.description,
            }));
    }

    async getRecentLogs(limit = 30, query?: { type?: TownAiCallLog["type"]; success?: boolean; fallbackUsed?: boolean; saveId?: string }) {
        return this.callLogRepo.find({
            where: {
                ...(query?.type ? { type: query.type } : {}),
                ...(typeof query?.success === "boolean" ? { success: query.success } : {}),
                ...(typeof query?.fallbackUsed === "boolean" ? { fallbackUsed: query.fallbackUsed } : {}),
                ...(query?.saveId ? { saveId: query.saveId } : {}),
            },
            order: { createdAt: "DESC" },
            take: limit,
        });
    }

    async getLogStats(query?: { type?: TownAiCallLog["type"]; success?: boolean; fallbackUsed?: boolean; saveId?: string }) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const baseWhere = {
            ...(query?.type ? { type: query.type } : {}),
            ...(typeof query?.success === "boolean" ? { success: query.success } : {}),
            ...(typeof query?.fallbackUsed === "boolean" ? { fallbackUsed: query.fallbackUsed } : {}),
            ...(query?.saveId ? { saveId: query.saveId } : {}),
        };
        const [total, todayCount, failed, fallback] = await Promise.all([
            this.callLogRepo.count({ where: baseWhere }),
            this.callLogRepo.count({ where: { ...baseWhere, createdAt: MoreThanOrEqual(today) } }),
            this.callLogRepo.count({ where: { ...baseWhere, success: false } }),
            this.callLogRepo.count({ where: { ...baseWhere, fallbackUsed: true } }),
        ]);
        return { total, todayCount, failed, fallback };
    }

    async generateAdvice(context: GenerateContext, fallback: string) {
        return this.generateTextWithFallback(
            "advice",
            context,
            this.buildAdvicePrompt(context, fallback),
            fallback,
        );
    }

    async generateStrategy(context: GenerateContext, fallback: string): Promise<{ strategy: AiTownStrategyDraft; fallbackUsed: boolean; billing: TownAiBillingContext }> {
        const fallbackDraft = this.createFallbackStrategyDraft(context, fallback);
        const result = await this.generateTextWithFallback(
            "advice",
            context,
            this.buildStrategyPrompt(context, fallbackDraft),
            JSON.stringify(fallbackDraft),
        );
        const parsed = this.parseStrategyDraft(result.text);
        return {
            strategy: this.normalizeStrategyDraft(parsed ?? fallbackDraft, fallbackDraft),
            fallbackUsed: !parsed,
            billing: { ...result.billing, fallbackUsed: result.billing.fallbackUsed || !parsed },
        };
    }

    async generateEvent(context: GenerateContext, fallback: string) {
        return this.generateTextWithFallback(
            "event",
            context,
            this.buildEventPrompt(context, fallback),
            fallback,
        );
    }

    async generateStructuredEvent(context: GenerateContext, fallback: string): Promise<{ title: string; content: string; choices: Array<{ id: string; label: string; hint: string }>; fallbackUsed: boolean; billing: TownAiBillingContext }> {
        const fallbackDraft = this.createFallbackEventDraft(fallback);
        const result = await this.generateTextWithFallback(
            "structured_event",
            context,
            this.buildStructuredEventPrompt(context, fallback),
            JSON.stringify(fallbackDraft),
        );
        const parsed = this.parseEventDraft(result.text);
        const draft = this.normalizeEventDraft(parsed ?? fallbackDraft, fallbackDraft);
        return {
            title: draft.title,
            content: draft.content,
            choices: draft.choices.map((choice) => ({ id: choice.intent, label: choice.label, hint: choice.hint })),
            fallbackUsed: !parsed,
            billing: { ...result.billing, fallbackUsed: result.billing.fallbackUsed || !parsed },
        };
    }

    async generateNpcReply(context: GenerateContext & { character: TownCharacter; message: string }, fallback: string): Promise<TownAiTextResult> {
        return this.generateTextWithFallback(
            "chat",
            context,
            this.buildNpcPrompt(context.character, context.message, context),
            fallback,
        );
    }

    async testGenerate(prompt: string) {
        return this.generateTextWithFallback("test", {}, prompt || "请用一句话介绍乐园小镇的今日计划。", "模型配置可用，小镇故事即将开始。", false);
    }

    private async generateTextWithFallback(type: TownAiCallLog["type"], context: GenerateContext, prompt: string, fallback: string, allowFallback = true): Promise<TownAiTextResult> {
        const startedAt = Date.now();
        const config = await this.getConfig();

        if (!config.enabled || !config.defaultModelId) {
            await this.logCall({
                type,
                context,
                config,
                success: false,
                fallbackUsed: allowFallback,
                latencyMs: Date.now() - startedAt,
                errorMessage: "AI 未启用或未配置模型",
                usage: null,
            });
            if (allowFallback) return { text: fallback, billing: this.createBillingContext(type, config, true) };
            throw new Error("AI 未启用或未配置模型");
        }

        if (shouldUseTownAiDailyLimit(config)) {
            await this.ensureDailyLimit(context.userId, config.dailyLimitPerUser);
        }

        try {
            const modelInfo = await this.loadLlmModel(config.defaultModelId);
            const result = await this.aiModelService.generateText(modelInfo.id, {
                prompt,
                temperature: config.temperature,
                maxOutputTokens: config.maxTokens,
            });
            const text = result.text.trim();
            if (!text) throw new Error("AI 返回为空");

            await this.logCall({
                type,
                context,
                config,
                success: true,
                fallbackUsed: false,
                latencyMs: Date.now() - startedAt,
                usage: result.usage ? { ...result.usage } : null,
            });
            return { text, billing: this.createBillingContext(type, config, false) };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.warn(`AI town ${type} generation failed: ${message}`);
            await this.logCall({
                type,
                context,
                config,
                success: false,
                fallbackUsed: allowFallback && config.fallbackToRules,
                latencyMs: Date.now() - startedAt,
                errorMessage: message,
                usage: null,
            });

            if (allowFallback && config.fallbackToRules) return { text: fallback, billing: this.createBillingContext(type, config, true) };
            throw error;
        }
    }

    private createBillingContext(type: TownAiCallLog["type"], config: TownAiConfig, fallbackUsed: boolean): TownAiBillingContext {
        const amount = type === "chat"
            ? Number(config.chatCostPower ?? 0)
            : type === "structured_event" || type === "event"
                ? Number(config.eventCostPower ?? 0)
                : type === "advice"
                    ? Number(config.adviceCostPower ?? 0)
                    : 0;
        const label = type === "chat" ? "居民聊天" : type === "structured_event" || type === "event" ? "探索导演" : type === "advice" ? "今日计划" : "测试生成";
        return { amount: Number.isFinite(amount) && amount > 0 ? Math.ceil(amount) : 0, label, fallbackUsed };
    }

    private createDefaultConfig(): TownAiConfig {
        return this.configRepo.create({
            key: TOWN_AI_CONFIG_KEY,
            ...(TOWN_AI_DEFAULT_CONFIG as Partial<TownAiConfig>),
        }) as TownAiConfig;
    }

    private async loadLlmModel(modelId: string) {
        const modelInfo = await this.aiModelService.getModelInfo(modelId);
        if (!modelInfo.isActive || !modelInfo.provider?.isActive || modelInfo.modelType !== "llm") {
            throw new Error("模型或 Provider 不存在、未激活，或不是 LLM 模型");
        }
        return modelInfo;
    }

    private async ensureDailyLimit(userId: string | undefined, limit: number) {
        if (!userId || limit <= 0) return;
        const today = getTownAiDayStart();
        const count = await this.callLogRepo.count({
            where: { userId, createdAt: MoreThanOrEqual(today) },
        });
        if (hasTownAiDailyLimitReached(count, limit)) {
            throw new Error("今日 AI 调用次数已达上限");
        }
    }

    private async logCall(params: {
        type: TownAiCallLog["type"];
        context: GenerateContext;
        config: TownAiConfig;
        success: boolean;
        fallbackUsed: boolean;
        latencyMs: number;
        errorMessage?: string;
        usage?: Record<string, unknown> | null;
    }) {
        await this.callLogRepo.save(
            this.callLogRepo.create({
                userId: params.context.userId ?? null,
                saveId: params.context.save?.id ?? null,
                type: params.type,
                modelId: params.config.defaultModelId ?? null,
                success: params.success,
                fallbackUsed: params.fallbackUsed,
                latencyMs: params.latencyMs,
                errorMessage: params.errorMessage ?? null,
                usage: params.usage ?? null,
            }),
        );
    }

    private buildAdvicePrompt(context: GenerateContext, fallback: string) {
        return [
            "你是治愈系开放世界小镇经营游戏的 AI 策划助手。",
            "请根据当前小镇状态，用中文给玩家一条具体、温暖、可执行的经营建议。",
            "不要输出 Markdown，不要超过 120 字。",
            `小镇状态：${JSON.stringify(this.pickSaveState(context.save))}`,
            `经营目标：${JSON.stringify(this.pickProgressState(context.save))}`,
            `居民：${JSON.stringify((context.characters ?? []).map((item) => ({ name: item.name, role: item.role, relationship: item.relationship, status: item.status })))}`,
            `最近事件：${JSON.stringify((context.events ?? []).slice(0, 5).map((item) => ({ type: item.type, title: item.title, content: item.content })))}`,
            `本地默认建议参考：${fallback}`,
        ].join("\n");
    }

    private buildStrategyPrompt(context: GenerateContext, fallback: AiTownStrategyDraft) {
        return [
            "你是治愈系开放世界小镇经营游戏的 AI 策划助手。",
            "请只输出 JSON，不要 Markdown，不要额外解释。",
            "JSON 结构：{\"summary\":\"总述\",\"action\":\"推荐行动\",\"target\":\"推荐目标\",\"reason\":\"推荐理由\",\"risk\":\"风险提醒\",\"expected\":\"预期收益\",\"nextStep\":\"下一步\"}",
            "所有字段必须是中文短句，不能提模型、fallback、本地规则、默认模型。",
            `小镇状态：${JSON.stringify(this.pickSaveState(context.save))}`,
            `经营目标：${JSON.stringify(this.pickProgressState(context.save))}`,
            `居民：${JSON.stringify((context.characters ?? []).map((item) => ({ name: item.name, role: item.role, relationship: item.relationship, status: item.status, memory: this.pickCharacterMemory(item) })))}`,
            `最近事件：${JSON.stringify((context.events ?? []).slice(0, 5).map((item) => ({ type: item.type, title: item.title, content: item.content, audit: this.pickEventAudit(item) })))}`,
            `安全策略参考：${JSON.stringify(fallback)}`,
        ].join("\n");
    }

    private buildNpcPrompt(character: TownCharacter, message: string, context: GenerateContext) {
        return [
            "你正在扮演治愈系小镇经营游戏中的居民角色。",
            "请用中文回复玩家，语气温暖自然，有角色性格，不要超过 100 字。",
            `居民：${character.name}，身份：${character.role}，性格：${character.personality}，关系值：${character.relationship}，状态：${character.status}`,
            `长期记忆：${JSON.stringify(this.pickCharacterMemory(character))}`,
            `小镇状态：${JSON.stringify(this.pickSaveState(context.save))}`,
            `经营目标：${JSON.stringify(this.pickProgressState(context.save))}`,
            `玩家说：${message}`,
        ].join("\n");
    }

    private buildEventPrompt(context: GenerateContext, fallback: string) {
        return [
            "你是治愈系开放世界小镇经营游戏的事件导演。",
            "请生成一段玩家探索街区时发生的随机事件，用中文输出，温暖、有画面感，并包含一个可继续经营的线索。",
            "不要输出 Markdown，不要超过 140 字。",
            `小镇状态：${JSON.stringify(this.pickSaveState(context.save))}`,
            `经营目标：${JSON.stringify(this.pickProgressState(context.save))}`,
            context.choice ? `玩家本次选择：${context.choice.label}（${context.choice.hint}）` : null,
            `居民：${JSON.stringify((context.characters ?? []).map((item) => ({ name: item.name, role: item.role, relationship: item.relationship, status: item.status })))}`,
            `最近事件：${JSON.stringify((context.events ?? []).slice(0, 5).map((item) => ({ type: item.type, title: item.title, content: item.content })))}`,
            `本地默认事件参考：${fallback}`,
        ].filter(Boolean).join("\n");
    }

    private buildStructuredEventPrompt(context: GenerateContext, fallback: string) {
        return [
            "你是治愈系开放世界小镇经营游戏的事件导演。",
            "请只输出 JSON，不要 Markdown，不要额外解释。",
            "JSON 结构：{\"title\":\"标题\",\"content\":\"80字内事件正文\",\"choices\":[{\"label\":\"选项名\",\"hint\":\"短提示\",\"intent\":\"operate|visit|explore|rest\"}]}",
            "choices 必须 2 到 3 个，intent 只能从 operate、visit、explore、rest 中选择。",
            `小镇状态：${JSON.stringify(this.pickSaveState(context.save))}`,
            `经营目标：${JSON.stringify(this.pickProgressState(context.save))}`,
            context.choice ? `玩家本次选择：${context.choice.label}（${context.choice.hint}）` : null,
            `居民：${JSON.stringify((context.characters ?? []).map((item) => ({ name: item.name, role: item.role, relationship: item.relationship, status: item.status })))}`,
            `最近事件：${JSON.stringify((context.events ?? []).slice(0, 5).map((item) => ({ type: item.type, title: item.title, content: item.content })))}`,
            `安全事件参考：${fallback}`,
        ].filter(Boolean).join("\n");
    }

    private pickCharacterMemory(character: TownCharacter) {
        const memory = character.memory ?? {};
        return {
            summary: memory.summary,
            relationshipLevel: memory.relationshipLevel,
            mood: memory.mood,
            preferences: Array.isArray(memory.preferences) ? memory.preferences.slice(-4) : [],
            promises: Array.isArray(memory.promises) ? memory.promises.slice(-3) : [],
            keyMoments: Array.isArray(memory.keyMoments) ? memory.keyMoments.slice(-3) : [],
            recentMessages: Array.isArray(memory.recentMessages) ? memory.recentMessages.slice(-3) : [],
        };
    }

    private pickEventAudit(event: TownEvent) {
        const audit = event.result?.audit;
        if (!audit) return null;
        return {
            source: audit.source,
            action: audit.action ? {
                type: audit.action.type,
                label: audit.action.label,
                day: audit.action.day,
            } : null,
            deltas: audit.deltas,
            ruleRefs: Array.isArray(audit.ruleRefs) ? audit.ruleRefs.slice(0, 6) : [],
            notes: Array.isArray(audit.notes) ? audit.notes.slice(0, 4) : [],
        };
    }

    private createFallbackEventDraft(fallback: string): AiTownEventDraft {
        return {
            title: "街区新线索",
            content: fallback.slice(0, 140),
            choices: [
                { label: "继续探索", hint: "发现新的街区事件", intent: "explore" },
                { label: "找居民聊聊", hint: "提升小镇氛围", intent: "visit" },
                { label: "回餐馆经营", hint: "稳定赚取金币", intent: "operate" },
            ],
        };
    }

    private normalizeEventDraft(draft: AiTownEventDraft, fallback: AiTownEventDraft): AiTownEventDraft {
        const title = this.trimText(draft.title, 40) || fallback.title;
        const content = this.trimText(draft.content, 160) || fallback.content;
        const seen = new Set<AiTownEventDraft["choices"][number]["intent"]>();
        const choices = (draft.choices ?? [])
            .filter((choice) => choice && this.isSupportedIntent(choice.intent) && typeof choice.label === "string" && typeof choice.hint === "string")
            .slice(0, 3)
            .map((choice) => ({
                label: this.trimText(choice.label, 18) || choice.label,
                hint: this.trimText(choice.hint, 36) || choice.hint,
                intent: choice.intent,
            }))
            .filter((choice) => {
                if (seen.has(choice.intent)) return false;
                seen.add(choice.intent);
                return true;
            });

        const nextChoices = [...choices];
        for (const choice of fallback.choices) {
            if (nextChoices.length >= 3) break;
            if (seen.has(choice.intent)) continue;
            nextChoices.push(choice);
            seen.add(choice.intent);
        }

        return {
            ...draft,
            title,
            content,
            choices: nextChoices.length >= 2 ? nextChoices : fallback.choices,
        };
    }

    private createFallbackStrategyDraft(context: GenerateContext, fallback: string): AiTownStrategyDraft {
        const save = context.save;
        const activeFestival = save?.worldState?.activeFestival;
        const task = save?.worldState?.dailyTasks?.find((item) => !item.completed);
        const topRelationship = context.characters?.[0];
        const action = save && save.stamina < 30 ? "休息一天" : task?.type === "earnCoins" ? "经营餐馆" : activeFestival ? this.formatStrategyAction(activeFestival.action) : "拜访居民";
        const target = activeFestival?.title ?? topRelationship?.name ?? task?.title ?? "小镇地图";
        return {
            summary: this.trimText(fallback.replace(/^AI 建议：/, "").replace(/^今日计划：/, ""), 80) || "今天先稳住资源，再推进居民关系和小镇活动。",
            action,
            target,
            reason: task ? `优先完成“${task.title}”，可以稳定获得奖励。` : activeFestival ? `当前活动“${activeFestival.title}”正在推进，适合围绕目标行动安排。` : "当前资源适合推进居民关系，为后续活动积累线索。",
            risk: save && save.stamina < 30 ? "体力偏低，避免连续高消耗行动。" : save && save.coins < 60 ? "金币偏紧，升级和布置前先保证现金流。" : "资源状态稳定，可以尝试推进活动或探索。",
            expected: activeFestival ? `可能推进${activeFestival.title}，并获得活动奖励。` : "可能获得金币、声望或居民关系收益。",
            nextStep: `${action}，然后观察小镇日志里的新线索。`,
        };
    }

    private normalizeStrategyDraft(draft: AiTownStrategyDraft, fallback: AiTownStrategyDraft): AiTownStrategyDraft {
        return {
            summary: this.trimText(draft.summary, 90) || fallback.summary,
            action: this.trimText(draft.action, 24) || fallback.action,
            target: this.trimText(draft.target, 28) || fallback.target,
            reason: this.trimText(draft.reason, 90) || fallback.reason,
            risk: this.trimText(draft.risk, 80) || fallback.risk,
            expected: this.trimText(draft.expected, 80) || fallback.expected,
            nextStep: this.trimText(draft.nextStep, 80) || fallback.nextStep,
        };
    }

    private parseStrategyDraft(text: string): AiTownStrategyDraft | null {
        const match = text.match(/\{[\s\S]*\}/);
        const parsed = safeJsonParse<Partial<AiTownStrategyDraft>>(match?.[0] ?? text);
        if (!parsed || typeof parsed !== "object") {
            return null;
        }
        return {
            summary: typeof parsed.summary === "string" ? parsed.summary : "",
            action: typeof parsed.action === "string" ? parsed.action : "",
            target: typeof parsed.target === "string" ? parsed.target : "",
            reason: typeof parsed.reason === "string" ? parsed.reason : "",
            risk: typeof parsed.risk === "string" ? parsed.risk : "",
            expected: typeof parsed.expected === "string" ? parsed.expected : "",
            nextStep: typeof parsed.nextStep === "string" ? parsed.nextStep : "",
        };
    }

    private formatStrategyAction(action: string) {
        const labels: Record<string, string> = { operate: "经营餐馆", visit: "拜访居民", decorate: "布置小镇", explore: "探索街区", upgrade: "升级建筑", rest: "休息一天" };
        return labels[action] ?? action;
    }

    private isSupportedIntent(intent: unknown): intent is AiTownEventDraft["choices"][number]["intent"] {
        return intent === "operate" || intent === "visit" || intent === "explore" || intent === "rest";
    }

    private trimText(text: string, limit: number) {
        const normalized = text.trim();
        return normalized.slice(0, limit);
    }

    private parseEventDraft(text: string): AiTownEventDraft | null {
        const match = text.match(/\{[\s\S]*\}/);
        const parsed = safeJsonParse<Partial<AiTownEventDraft>>(match?.[0] ?? text);
        if (!parsed || typeof parsed !== "object") {
            return null;
        }
        return {
            title: typeof parsed.title === "string" ? parsed.title : "",
            content: typeof parsed.content === "string" ? parsed.content : "",
            choices: Array.isArray(parsed.choices)
                ? parsed.choices
                    .filter((choice) => choice && typeof choice.label === "string" && typeof choice.hint === "string" && this.isSupportedIntent(choice.intent))
                    .slice(0, 3)
                    .map((choice) => ({ label: String(choice.label), hint: String(choice.hint), intent: choice.intent as AiTownEventDraft["choices"][number]["intent"] }))
                : [],
            tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5).map(String) : undefined,
            buildingId: typeof parsed.buildingId === "string" ? parsed.buildingId : undefined,
            characterRole: typeof parsed.characterRole === "string" ? parsed.characterRole : undefined,
        };
    }

    private pickSaveState(save?: TownSave) {
        if (!save) return null;
        return {
            name: save.name,
            level: save.level,
            coins: save.coins,
            stamina: save.stamina,
            day: save.day,
            mood: save.mood,
            worldState: save.worldState,
        };
    }

    private pickProgressState(save?: TownSave) {
        if (!save?.worldState) return null;
        return {
            weather: save.worldState.weather,
            areas: save.worldState.unlockedAreas,
            buildings: save.worldState.buildings?.map((building) => ({ id: building.id, name: building.name, level: building.level, effect: building.effect })),
            tasks: save.worldState.dailyTasks?.map((task) => ({ title: task.title, progress: task.progress, target: task.target, completed: task.completed })),
            weeklyGoal: save.worldState.weeklyGoal ? { title: save.worldState.weeklyGoal.title, progress: save.worldState.weeklyGoal.progress, target: save.worldState.weeklyGoal.target, completed: save.worldState.weeklyGoal.completed } : null,
            mainQuest: save.worldState.mainQuest ? { chapter: save.worldState.mainQuest.chapter, title: save.worldState.mainQuest.title, requirements: save.worldState.mainQuest.requirements } : null,
            achievements: save.worldState.achievements,
            lastSettlement: save.worldState.lastSettlement,
        };
    }
}
