import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const aiServiceSource = readFileSync(new URL("../src/api/modules/town/services/town-ai.service.ts", import.meta.url), "utf8");
const actionCatalogSource = readFileSync(new URL("../src/api/modules/town/catalog/town-actions.catalog.ts", import.meta.url), "utf8");
const buildingCatalogSource = readFileSync(new URL("../src/api/modules/town/catalog/town-buildings.catalog.ts", import.meta.url), "utf8");
const characterCatalogSource = readFileSync(new URL("../src/api/modules/town/catalog/town-characters.catalog.ts", import.meta.url), "utf8");
const choiceCatalogSource = readFileSync(new URL("../src/api/modules/town/catalog/town-choices.catalog.ts", import.meta.url), "utf8");
const festivalCatalogSource = readFileSync(new URL("../src/api/modules/town/catalog/town-festivals.catalog.ts", import.meta.url), "utf8");
const progressCatalogSource = readFileSync(new URL("../src/api/modules/town/catalog/town-progress.catalog.ts", import.meta.url), "utf8");
const characterEntitySource = readFileSync(new URL("../src/api/db/entities/town-character.entity.ts", import.meta.url), "utf8");
const progressRulesSource = readFileSync(new URL("../src/api/modules/town/services/town-progress-rules.service.ts", import.meta.url), "utf8");
const relationshipRulesSource = readFileSync(new URL("../src/api/modules/town/services/town-relationship-rules.service.ts", import.meta.url), "utf8");
const worldRulesSource = readFileSync(new URL("../src/api/modules/town/services/town-world-rules.service.ts", import.meta.url), "utf8");
const townServiceSource = readFileSync(new URL("../src/api/modules/town/services/town.service.ts", import.meta.url), "utf8");
const townGameRulesSource = readFileSync(new URL("../src/web/lib/game-rules.ts", import.meta.url), "utf8");
const townViewModelSource = readFileSync(new URL("../src/web/lib/town-view-model.ts", import.meta.url), "utf8");
const townPageSource = readFileSync(new URL("../src/web/pages/index.tsx", import.meta.url), "utf8");
const townGamePanelsSource = readFileSync(new URL("../src/web/components/game-panels.tsx", import.meta.url), "utf8");
const townConsoleSaveListSource = readFileSync(new URL("../src/web/pages/console/saves/list.tsx", import.meta.url), "utf8");

test("world rules keep deterministic building costs and unlock rules", () => {
    assert.match(worldRulesSource, /getBuildingUpgradeCost\(level: number\)/);
    assert.match(worldRulesSource, /return 60 \+ level \* 35/);
    assert.match(worldRulesSource, /area: "夜市街角", unlocked: worldState\.reputation >= 30/);
    assert.match(worldRulesSource, /area: "二层露台", unlocked: this\.getBuildingLevel\(worldState, "restaurant"\) >= 3/);
    assert.match(worldRulesSource, /area: "庆典会场"/);
});

test("town defaults are catalog-backed for content-pack expansion", () => {
    assert.match(buildingCatalogSource, /export const TOWN_BUILDING_CATALOG/);
    assert.match(buildingCatalogSource, /id: "restaurant"/);
    assert.match(buildingCatalogSource, /export const TOWN_INITIAL_AREAS/);
    assert.match(characterCatalogSource, /export const TOWN_CHARACTER_CATALOG/);
    assert.match(characterCatalogSource, /name: "小满"/);
    assert.match(actionCatalogSource, /export const TOWN_ACTION_CATALOG/);
    assert.match(actionCatalogSource, /resolveTownActionCatalogValue/);
    assert.match(choiceCatalogSource, /export const TOWN_CHOICE_CATALOG/);
    assert.match(choiceCatalogSource, /createTownChoiceCatalog\(\)/);
    assert.match(progressCatalogSource, /export const TOWN_DAILY_TASK_ROTATION/);
    assert.match(progressCatalogSource, /export const TOWN_WEEKLY_GOAL_ROTATION/);
    assert.match(progressCatalogSource, /export const TOWN_MAIN_QUEST_CATALOG/);
    assert.match(progressCatalogSource, /export const TOWN_ACHIEVEMENT_CATALOG/);
    assert.match(festivalCatalogSource, /export const TOWN_FESTIVAL_CATALOG/);
    assert.match(festivalCatalogSource, /createTownFestivalState/);
    assert.match(townServiceSource, /buildings: createDefaultTownBuildings\(\)/);
    assert.match(townServiceSource, /TOWN_CHARACTER_CATALOG\.map/);
    assert.match(townServiceSource, /const catalogItem = TOWN_ACTION_CATALOG\[action\]/);
    assert.match(townServiceSource, /TOWN_CHOICE_ACTION_OVERRIDES\[choice\.id\]/);
    assert.match(townServiceSource, /return createTownChoiceCatalog\(\)/);
    assert.doesNotMatch(townServiceSource, /buildings:\s*\[\s*\{ id: "restaurant"/);
    assert.match(progressRulesSource, /return createTownDailyTasks\(day\)/);
    assert.match(progressRulesSource, /return createTownWeeklyGoal\(day\)/);
    assert.match(progressRulesSource, /return createTownMainQuest\(chapter\)/);
    assert.match(progressRulesSource, /for \(const rule of TOWN_ACHIEVEMENT_CATALOG\)/);
    assert.match(worldRulesSource, /TOWN_FESTIVAL_CATALOG\.find/);
    assert.match(worldRulesSource, /createTownFestivalState\(candidate\)/);
    assert.doesNotMatch(progressRulesSource, /const earlyVariants/);
    assert.doesNotMatch(worldRulesSource, /const candidates: TownFestivalState\[\]/);
});

test("world rules advance countdown festivals and record completions", () => {
    assert.match(worldRulesSource, /advanceFestival\(worldState: TownWorldState, save: TownSave, action: string\)/);
    assert.match(festivalCatalogSource, /status: "announced"/);
    assert.match(festivalCatalogSource, /daysLeft: 3/);
    assert.match(worldRulesSource, /completedFestivals/);
    assert.match(townServiceSource, /活动完成：\$\{event\.title\}/);
    assert.match(townServiceSource, /save\.coins = Math\.max\(0, save\.coins \+ \(reward\.coins \?\? 0\)\)/);
});

test("progress rules preserve task, weekly, quest, and achievement loops", () => {
    assert.match(progressRulesSource, /createDailyTasks\(day: number\)/);
    assert.match(progressCatalogSource, /type: "earnCoins"/);
    assert.match(progressCatalogSource, /type: "gainReputation"/);
    assert.match(progressRulesSource, /createWeeklyGoal\(day = 1\)/);
    assert.match(progressRulesSource, /createMainQuest\(chapter: number\)/);
    assert.match(progressRulesSource, /applyProgress\(/);
    assert.match(progressRulesSource, /skipDailyProgress\?: boolean/);
    assert.match(progressRulesSource, /if \(!context\.skipDailyProgress\) \{/);
    assert.match(progressRulesSource, /if \(!context\.skipDailyProgress && worldState\.weeklyGoal/);
    assert.match(progressCatalogSource, /第一桶金/);
    assert.match(progressCatalogSource, /庆典小镇/);
});

test("relationship rules gate story events on relationship level changes", () => {
    assert.match(relationshipRulesSource, /getRelationshipLevel\(value: number\)/);
    assert.match(relationshipRulesSource, /if \(value >= 80\) return "羁绊"/);
    assert.match(relationshipRulesSource, /applyCharacterRelationship\(/);
    assert.match(relationshipRulesSource, /createNpcStoryEvent\(/);
    assert.match(townServiceSource, /return update\.oldLevel === update\.newLevel \? \[\] : \[story, this\.createRelationshipLevelEvent/);
});

test("relationship rules expose NPC operating bonuses", () => {
    assert.match(relationshipRulesSource, /getRelationshipBonuses\(characters: TownCharacter\[], action: string\)/);
    assert.match(relationshipRulesSource, /小满帮厨/);
    assert.match(relationshipRulesSource, /花音花艺/);
    assert.match(relationshipRulesSource, /旅人向导/);
    assert.match(relationshipRulesSource, /getUpgradeDiscount\(characters: TownCharacter\[]\)/);
    assert.match(townServiceSource, /result\.bonuses = bonuses\.map\(\(bonus\) => bonus\.label\)/);
});

test("structured AI events normalize unsafe model output", () => {
    assert.match(aiServiceSource, /normalizeEventDraft\(/);
    assert.match(aiServiceSource, /isSupportedIntent\(/);
    assert.match(aiServiceSource, /fallbackUsed: !parsed/);
    assert.match(aiServiceSource, /choices: nextChoices\.length >= 2 \? nextChoices : fallback\.choices/);
    assert.match(aiServiceSource, /intent === "operate" \|\| intent === "visit" \|\| intent === "explore" \|\| intent === "rest"/);
});

test("AI strategy advice is structured and hidden from model details", () => {
    assert.match(aiServiceSource, /generateStrategy\(context: GenerateContext, fallback: string\)/);
    assert.match(aiServiceSource, /buildStrategyPrompt\(context: GenerateContext, fallback: AiTownStrategyDraft\)/);
    assert.match(aiServiceSource, /normalizeStrategyDraft\(/);
    assert.match(aiServiceSource, /parseStrategyDraft\(/);
    assert.match(aiServiceSource, /不能提模型、fallback、本地规则、默认模型/);
    assert.match(townServiceSource, /strategy: advice\.strategy/);
    assert.match(townServiceSource, /result\.strategy = preparedAi\.strategy/);
    assert.match(townServiceSource, /result\.fallbackUsed = true/);
});

test("action budget prevents same-day action spam and resets on rest", () => {
    assert.match(townServiceSource, /type TownActionBudgetState = \{/);
    assert.match(townServiceSource, /createActionBudgetState\(day: number, maxPerDay = 4\)/);
    assert.match(townServiceSource, /normalizeActionBudgetState\(budget: unknown, fallbackDay: number\)/);
    assert.match(townServiceSource, /consumeActionBudget\(save: TownSave, action: TownActionDto\["action"\]\)/);
    assert.match(townServiceSource, /flags:\s*\{\s*\.\.\.\(worldState\.flags \?\? \{\}\),\s*actionBudget: budget,\s*\}/);
    assert.match(townServiceSource, /if \(budget\.usedActions\.includes\(action\)\)/);
    assert.match(townServiceSource, /今天已经做过这个行动了，换个行动或休息到明天/);
    assert.match(townServiceSource, /今天的行动次数已用完，先休息到明天/);
    assert.match(townServiceSource, /action === "rest" \? this\.createActionBudgetState\(save\.day, budget\.maxPerDay\) : budget/);
    assert.match(townServiceSource, /skipDailyProgress: dto\.action === "rest"/);
});

test("retention hooks turn daily play into a next-session reason", () => {
    assert.match(townServiceSource, /type TownRetentionState = NonNullable<TownWorldState\["retention"\]>/);
    assert.match(townServiceSource, /retention: this\.createRetentionState\(1\)/);
    assert.match(townServiceSource, /private markRetentionQualified\(save: TownSave, action: RetentionActionInput, progress: ProgressResult, characters: TownCharacter\[] = \[\]\)/);
    assert.match(townServiceSource, /lastQualifiedDay: save\.day/);
    assert.match(townServiceSource, /private advanceRetentionAfterRest\(save: TownSave, characters: TownCharacter\[] = \[\]\)/);
    assert.match(townServiceSource, /const qualifiedDay = save\.day - 1/);
    assert.match(townServiceSource, /: 0;/);
    assert.match(townServiceSource, /private createNextHook\(worldState: TownWorldState, day: number, completedProgressCount = 0, characters: TownCharacter\[] = \[\]\): TownRetentionHook/);
    assert.match(townServiceSource, /private createMemoryRetentionHook\(day: number, characters: TownCharacter\[]\): TownRetentionHook \| null/);
    assert.match(townServiceSource, /下次回应\$\{character\.name\}/);
    assert.match(townServiceSource, /居民记忆把聊天内容延续到下一次行动/);
    assert.match(townGameRulesSource, /export function getRetentionHookTarget\(save: TownSave \| null\)/);
    assert.match(townGameRulesSource, /const hookTarget = getRetentionHookTarget\(save\);/);
    assert.match(townGameRulesSource, /save\.worldState\.retention\.nextHook\.reason/);
    assert.match(townViewModelSource, /export function createRetentionViewModel\(save: TownSave\): TownRetentionViewModel/);
    assert.match(townViewModelSource, /retention: createRetentionViewModel\(save\)/);
    assert.match(townGamePanelsSource, /连续开张 \{retention\.streak \? `\$\{retention\.streak\} 天` : "未开始"\}/);
    assert.match(townGamePanelsSource, /goal\.retention\.nextHook\.title/);
});

test("event results and settlement keep player-readable audit explanations", () => {
    assert.match(townServiceSource, /private refreshResultAudit\(save: TownSave, result: TownEventResult/);
    assert.match(townServiceSource, /const before = this\.createResultSnapshot\(save\)/);
    assert.match(townServiceSource, /this\.refreshResultAudit\(save, result, context, before\)/);
    assert.match(townServiceSource, /type TownActionAuditContext = \{/);
    assert.match(townServiceSource, /const auditBudgetBefore = this\.getActionBudgetState\(save\)/);
    assert.match(townServiceSource, /const consumedBudget = this\.consumeActionBudget\(save, dto\.action\)/);
    assert.match(townServiceSource, /auditContext\.relationshipTarget = \{ id: relationshipTarget\.id, name: relationshipTarget\.name \}/);
    assert.match(townServiceSource, /const ruleRefs = this\.createResultRuleRefs\(context\)/);
    assert.match(townServiceSource, /ruleRefs,/);
    assert.match(townServiceSource, /source: context\.source/);
    assert.match(townServiceSource, /action: \{/);
    assert.match(townServiceSource, /budget: this\.createResultBudgetAudit\(context\)/);
    assert.match(townServiceSource, /resourceBreakdown: this\.createResourceBreakdown\(result, context\)/);
    assert.match(townServiceSource, /model: \{/);
    assert.match(townServiceSource, /日结收入 \+\$\{context\.settlement\.income\}，维护 -\$\{context\.settlement\.maintenance\}/);
    assert.match(worldRulesSource, /breakdown: \[/);
    assert.match(worldRulesSource, /label: "餐馆收入"/);
    assert.match(worldRulesSource, /label: "建筑维护", value: -maintenance/);
    assert.match(townGamePanelsSource, /result-audit-panel/);
    assert.match(townGamePanelsSource, /result-audit-meta/);
    assert.match(townGamePanelsSource, /result-breakdown-list/);
    assert.match(townGamePanelsSource, /formatRuleRef\(rule: string\)/);
    assert.match(townGamePanelsSource, /settlement-breakdown/);
});

test("npc memory keeps long-term summaries without unbounded prompt growth", () => {
    assert.match(characterEntitySource, /export type TownCharacterMemory = \{/);
    assert.match(characterEntitySource, /preferences\?: string\[]/);
    assert.match(characterEntitySource, /keyMoments\?: Array<\{ day: number; title: string; summary: string \}>/);
    assert.match(townServiceSource, /private updateCharacterMemory\(character: TownCharacter, message: string, reply: string, day: number\): TownCharacterMemory/);
    assert.match(townServiceSource, /recentMessages: nextRecentMessages\.slice\(-6\)/);
    assert.match(townServiceSource, /private summarizeCharacterMemory/);
    assert.match(aiServiceSource, /private pickCharacterMemory\(character: TownCharacter\)/);
    assert.match(aiServiceSource, /recentMessages: Array\.isArray\(memory\.recentMessages\) \? memory\.recentMessages\.slice\(-3\) : \[\]/);
    assert.doesNotMatch(aiServiceSource, /memory: item\.memory/);
    assert.doesNotMatch(aiServiceSource, /result: item\.result/);
    assert.match(aiServiceSource, /memory: this\.pickCharacterMemory\(item\)/);
    assert.match(aiServiceSource, /audit: this\.pickEventAudit\(item\)/);
    assert.match(townGamePanelsSource, /npc-memory-tags/);
    assert.match(townGamePanelsSource, /npc-key-moments/);
    assert.match(townConsoleSaveListSource, /关键时刻 \$\{character\.memory\.keyMoments\.length\}/);
});

test("npc promises can return as memory-driven gameplay events", () => {
    assert.match(townServiceSource, /private createPromiseReminderEvent\(userId: string, saveId: string, character: TownCharacter, action: TownActionDto\["action"\], day: number\): TownEvent \| null/);
    assert.match(townServiceSource, /type: "memory_promise"/);
    assert.match(townServiceSource, /promises: promises\.slice\(1\)/);
    assert.match(townServiceSource, /character\.relationship = Math\.min\(100, character\.relationship \+ 1\)/);
    assert.match(townServiceSource, /ruleRefs: \["rule:npc-memory", `action:\$\{action\}`\]/);
    assert.match(townGameRulesSource, /memory_promise/);
    assert.match(townGamePanelsSource, /eventType === "memory_promise"/);
});

test("pending npc promises shape recommendations and operations diagnostics", () => {
    assert.match(townGameRulesSource, /export function getPendingMemoryPromiseCharacter\(save: TownSave \| null\)/);
    assert.match(townGameRulesSource, /const memoryTarget = getPendingMemoryPromiseCharacter\(save\);/);
    assert.match(townGameRulesSource, /if \(memoryTarget\) return memoryTarget\.id;/);
    assert.match(townGameRulesSource, /拜访能让记忆回到今天的行动循环/);
    assert.match(townGameRulesSource, /items\.push\("记忆回响"\)/);
    assert.match(townGameRulesSource, /还记着一个约定，今天适合去回应/);
    assert.match(townViewModelSource, /pendingPromiseCount: promises\.length/);
    assert.match(townViewModelSource, /memoryPromiseCount: getMemoryPromiseCount\(save\)/);
    assert.match(townPageSource, /has-memory-promise/);
    assert.match(townPageSource, /title=\{character\.pendingPromise \? `记着：\$\{character\.pendingPromise\}` : character\.memorySummary\}/);
    assert.match(townGamePanelsSource, /待回应约定 \{goal\.memoryPromiseCount\} 条/);
    assert.match(townConsoleSaveListSource, /<TableHead>记忆线索<\/TableHead>/);
    assert.match(townConsoleSaveListSource, /详情可见/);
    assert.match(townConsoleSaveListSource, /待回应约定较多/);
});

test("web town view model centralizes hud goals hotspots and commands", () => {
    assert.match(townViewModelSource, /export function createTownViewModel\(save: TownSave, latestEvent: TownEvent \| null = save\.events\[0\] \?\? null\): TownViewModel/);
    assert.match(townViewModelSource, /export function createHudViewModel\(save: TownSave\): TownHudViewModel/);
    assert.match(townViewModelSource, /export function getBuildingHotspots\(save: TownSave/);
    assert.match(townViewModelSource, /export function getCharacterHotspots\(save: TownSave/);
    assert.match(townViewModelSource, /export function getCommandBarState\(save: TownSave/);
    assert.match(townViewModelSource, /export function getActionState\(save: TownSave, action: string, buildingId\?: string\): TownActionStateViewModel/);
    assert.match(townViewModelSource, /export function getActionBudget\(save: TownSave\): TownActionBudgetViewModel/);
    assert.match(townViewModelSource, /export function createGoalViewModel\(save: TownSave\): TownGoalViewModel/);
    assert.match(townViewModelSource, /export function createEventSummary\(event: TownEvent\): TownEventSummaryViewModel/);
    assert.match(townPageSource, /const viewModel = save \? createTownViewModel\(save\) : null;/);
    assert.match(townPageSource, /const actionState = save \? getActionState\(save, action, params\?\.buildingId\) : null;/);
    assert.match(townPageSource, /<CompactGoalBoard goal=\{viewModel\.goal\}/);
    assert.match(townPageSource, /<CommandSummary commands=\{viewModel\.commands\} pending=\{actionMutation\.isPending\}/);
});

test("all player action buttons reuse unified action state and previews", () => {
    assert.match(townViewModelSource, /const preview = getChoicePreview\(save, action, buildingId\);/);
    assert.match(townViewModelSource, /const taskLinked = Boolean\(getActionTask\(save, action\)\);/);
    assert.match(townGamePanelsSource, /const actionState = getActionState\(save, buildingAction\);/);
    assert.match(townGamePanelsSource, /const secondaryState = secondaryAction \? getActionState\(save, secondaryAction\) : null;/);
    assert.match(townGamePanelsSource, /const upgradeState = getActionState\(save, "upgrade", building\.id\);/);
    assert.match(townGamePanelsSource, /function ActionPreviewList/);
    assert.match(townGamePanelsSource, /const actionState = getActionState\(save, choice\.id\);/);
    assert.doesNotMatch(townGamePanelsSource, /getActionAffordability\(save, choice\.id\)/);
    assert.doesNotMatch(townGamePanelsSource, /getActionAffordability\(save, buildingAction\)/);
});

test("web copy keeps player-facing AI wording restrained", () => {
    assert.doesNotMatch(townPageSource, />AI乐园小镇</);
    assert.doesNotMatch(townPageSource, /EchoflowAI H5 Game/);
    assert.doesNotMatch(townGameRulesSource, /居民与 AI/);
    assert.doesNotMatch(townGameRulesSource, /advice: "AI 建议"/);
    assert.doesNotMatch(townGamePanelsSource, /智能事件/);
    assert.doesNotMatch(townGamePanelsSource, /使用智能建议/);
    assert.match(townGameRulesSource, /居民与参谋/);
    assert.match(townGameRulesSource, /advice: "今日计划"/);
    assert.match(townGamePanelsSource, /生成今日计划/);
    assert.match(townPageSource, />乐园小镇</);
});

test("empty save state opens as a playable town scene", () => {
    assert.match(townPageSource, /className="game-stage onboarding-stage"/);
    assert.match(townPageSource, /ASSETS\.backgrounds\.town/);
    assert.match(townPageSource, /queryFn: listTownSaves,\s*retry: false,/);
    assert.match(readFileSync(new URL("../src/web/services/web/town.ts", import.meta.url), "utf8"), /apiHttpClient\.get<TownSaveListResult>\("\/ai-town\/saves", \{ silent: true \}\)/);
    assert.match(townPageSource, /onboarding-hotspots/);
    assert.match(townPageSource, /onboarding-command-preview/);
    assert.match(townPageSource, /npc-preview-avatar/);
    assert.match(townPageSource, /创建小镇/);
    assert.doesNotMatch(townPageSource, /game-title-screen/);
    assert.doesNotMatch(townPageSource, /ASSETS\.cover/);
    assert.doesNotMatch(townPageSource, /className="avatar"/);
});

test("console save detail exposes action budget diagnostics", () => {
    assert.match(townConsoleSaveListSource, /今日行动：\{actionBudget\.remaining\}\/\{actionBudget\.maxPerDay\} · 已用 \{actionBudget\.used\} · 最近动作/);
    assert.match(townConsoleSaveListSource, /今日行动已用完/);
    assert.match(townConsoleSaveListSource, /getActionBudgetSnapshot\(save: TownSave\)/);
    assert.match(townConsoleSaveListSource, /<TableHead>今日行动<\/TableHead>/);
});

test("game modal shell now behaves like a drawer", () => {
    assert.match(townPageSource, /GameModalShell key=\{modal\} title=\{getModalTitle\(modal, selectedBuilding, activeCharacter\)\} onClose=\{\(\) => setModal\(null\)\}/);
    assert.match(townPageSource, /modal === "building"/);
    assert.match(townGamePanelsSource, /className="game-drawer-backdrop"/);
    assert.match(townGamePanelsSource, /className="game-drawer"/);
});

test("today plan can execute a mapped recommended action", () => {
    assert.match(townGamePanelsSource, /onRunRecommendedAction\?: \(action: string\) => void/);
    assert.match(townGamePanelsSource, /function mapStrategyAction\(action: string\)/);
    assert.match(townGamePanelsSource, /function mapPlanAction\(actionLabel: string\)/);
    assert.match(townGamePanelsSource, /const recommendedActionState = recommendedAction \? getActionState\(save, recommendedAction\) : null;/);
    assert.match(townGamePanelsSource, /className=\{recommendedActionState\?\.canRun \? "strategy-action-card ready" : "strategy-action-card blocked"\}/);
    assert.match(townGamePanelsSource, /执行推荐行动/);
    assert.match(townPageSource, /<AdvicePanel save=\{save\} latestEvent=\{latestEvent\} onRunRecommendedAction=\{\(action\) => runAction\(action\)\}/);
});
