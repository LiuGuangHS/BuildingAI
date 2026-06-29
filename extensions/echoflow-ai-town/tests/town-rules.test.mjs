import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const aiServiceSource = readFileSync(new URL("../src/api/modules/town/services/town-ai.service.ts", import.meta.url), "utf8");
const actionCatalogSource = readFileSync(new URL("../src/api/modules/town/catalog/town-actions.catalog.ts", import.meta.url), "utf8");
const buildingCatalogSource = readFileSync(new URL("../src/api/modules/town/catalog/town-buildings.catalog.ts", import.meta.url), "utf8");
const characterCatalogSource = readFileSync(new URL("../src/api/modules/town/catalog/town-characters.catalog.ts", import.meta.url), "utf8");
const choiceCatalogSource = readFileSync(new URL("../src/api/modules/town/catalog/town-choices.catalog.ts", import.meta.url), "utf8");
const contentPackCatalogSource = readFileSync(new URL("../src/api/modules/town/catalog/town-content-pack.catalog.ts", import.meta.url), "utf8");
const festivalCatalogSource = readFileSync(new URL("../src/api/modules/town/catalog/town-festivals.catalog.ts", import.meta.url), "utf8");
const progressCatalogSource = readFileSync(new URL("../src/api/modules/town/catalog/town-progress.catalog.ts", import.meta.url), "utf8");
const catalogIndexSource = readFileSync(new URL("../src/api/modules/town/catalog/index.ts", import.meta.url), "utf8");
const characterEntitySource = readFileSync(new URL("../src/api/db/entities/town-character.entity.ts", import.meta.url), "utf8");
const townSaveEntitySource = readFileSync(new URL("../src/api/db/entities/town-save.entity.ts", import.meta.url), "utf8");
const progressRulesSource = readFileSync(new URL("../src/api/modules/town/services/town-progress-rules.service.ts", import.meta.url), "utf8");
const relationshipRulesSource = readFileSync(new URL("../src/api/modules/town/services/town-relationship-rules.service.ts", import.meta.url), "utf8");
const worldRulesSource = readFileSync(new URL("../src/api/modules/town/services/town-world-rules.service.ts", import.meta.url), "utf8");
const townServiceSource = readFileSync(new URL("../src/api/modules/town/services/town.service.ts", import.meta.url), "utf8");
const upgradeSource = readFileSync(new URL("../src/api/upgrade/0.0.1/index.ts", import.meta.url), "utf8");
const townGameRulesSource = readFileSync(new URL("../src/web/lib/game-rules.ts", import.meta.url), "utf8");
const townViewModelSource = readFileSync(new URL("../src/web/lib/town-view-model.ts", import.meta.url), "utf8");
const townPageSource = readFileSync(new URL("../src/web/pages/index.tsx", import.meta.url), "utf8");
const townGamePanelsSource = readFileSync(new URL("../src/web/components/game-panels.tsx", import.meta.url), "utf8");
const townAssetsSource = readFileSync(new URL("../src/web/assets.ts", import.meta.url), "utf8");
const townStylesSource = readFileSync(new URL("../src/web/styles/index.css", import.meta.url), "utf8");
const townConsoleSaveListSource = readFileSync(new URL("../src/web/pages/console/saves/list.tsx", import.meta.url), "utf8");
const townConsoleContentPackSource = readFileSync(new URL("../src/web/pages/console/content-pack.tsx", import.meta.url), "utf8");
const townConsoleAiConfigSource = readFileSync(new URL("../src/web/pages/console/ai-config.tsx", import.meta.url), "utf8");
const townRoutesSource = readFileSync(new URL("../src/web/routes.tsx", import.meta.url), "utf8");
const townManifestSource = readFileSync(new URL("../manifest.json", import.meta.url), "utf8");
const townPackageSource = readFileSync(new URL("../package.json", import.meta.url), "utf8");
const townReadmeSource = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const rootAgentsSource = readFileSync(new URL("../../../AGENTS.md", import.meta.url), "utf8");
const townConsoleControllerSource = readFileSync(new URL("../src/api/modules/town/controllers/console/town.controller.ts", import.meta.url), "utf8");
const townConsoleServiceSource = readFileSync(new URL("../src/web/services/console/town.ts", import.meta.url), "utf8");
const townWebTypesSource = readFileSync(new URL("../src/web/services/types.ts", import.meta.url), "utf8");

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

test("save picker returns players to the town instead of generic app loading", () => {
    assert.match(townGamePanelsSource, /export function SavePicker/);
    assert.match(townGamePanelsSource, /<h3>回到小镇<\/h3>/);
    assert.match(townGamePanelsSource, /aria-label=\{`回到存档：\$\{save\.name\}`\}/);
    assert.match(townGamePanelsSource, /pendingId === save\.id \? "读取街区" : "回到存档"/);
    assert.doesNotMatch(townGamePanelsSource, /继续旧存档/);
    assert.doesNotMatch(townGamePanelsSource, /pendingId === save\.id \? "载入中" : "继续"/);
    assert.match(townReadmeSource, /存档入口 \| ready \| 旧存档列表使用回到小镇、回到存档和读取街区等游戏语境文案/);
    assert.match(rootAgentsSource, /旧存档、历史记录或继续入口也应使用回到小镇、回到存档、打开作品或继续创作等业务语境/);
});

test("save removal keeps destructive controls in town archive language", () => {
    assert.match(townGamePanelsSource, /<Button type="button" variant="destructive" className="danger-button">移除存档<\/Button>/);
    assert.match(townGamePanelsSource, /<AlertDialogTitle>移入旧档箱<\/AlertDialogTitle>/);
    assert.match(townGamePanelsSource, /确认把「\{save\.name\}」移入旧档箱吗？这座小镇会从当前列表离开，相关居民和事件也会一同归档。/);
    assert.match(townGamePanelsSource, /<AlertDialogCancel>留在小镇<\/AlertDialogCancel>/);
    assert.match(townGamePanelsSource, /<AlertDialogAction onClick=\{\(\) => onDelete\(save\.id\)\}>移入旧档箱<\/AlertDialogAction>/);
    assert.doesNotMatch(townGamePanelsSource, />删除<\/Button>/);
    assert.doesNotMatch(townGamePanelsSource, />删除<\/AlertDialogAction>/);
    assert.doesNotMatch(townGamePanelsSource, /确认删除/);
    assert.doesNotMatch(townGamePanelsSource, /此操作不可恢复/);
    assert.doesNotMatch(townGamePanelsSource, />取消<\/AlertDialogCancel>/);
    assert.match(townReadmeSource, /存档移除 \| ready \| 存档删除弹窗使用移入旧档箱、留在小镇等小镇归档语境/);
    assert.match(rootAgentsSource, /经营游戏的删除、取消、确认等破坏性操作也应转换为业务对象和玩家动作/);
});

test("public plugin metadata introduces the town as a game instead of generic AI app chrome", () => {
    assert.match(townManifestSource, /"name": "乐园小镇"/);
    assert.match(townManifestSource, /"description": "治愈系小镇经营游戏/);
    assert.doesNotMatch(townManifestSource, /AI乐园小镇/);
    assert.doesNotMatch(townManifestSource, /AI 趣味玩法应用/);
    assert.match(townPackageSource, /"description": "Town life management narrative game extension"/);
    assert.doesNotMatch(townPackageSource, /AI open world/);
    assert.match(upgradeSource, /import manifest from "\.\.\/\.\.\/\.\.\/\.\.\/manifest\.json";/);
    assert.match(upgradeSource, /name: manifest\.name/);
    assert.match(upgradeSource, /description: manifest\.description/);
    assert.doesNotMatch(upgradeSource, /name: "AI乐园小镇/);
    assert.doesNotMatch(upgradeSource, /AI 趣味玩法应用/);
    assert.match(townReadmeSource, /公开元信息 \| ready \| 插件 manifest、package 和安装记录使用乐园小镇与经营叙事游戏语境/);
    assert.match(rootAgentsSource, /插件公开元信息会出现在应用列表、安装记录或市场入口/);
});

test("content pack manifest defines launch season and save normalization strategy", () => {
    assert.match(contentPackCatalogSource, /export type TownContentPackId = "launch-core"/);
    assert.match(contentPackCatalogSource, /export type TownContentSeasonId = "season-0"/);
    assert.match(contentPackCatalogSource, /export const TOWN_CONTENT_PACK_MANIFEST/);
    assert.match(contentPackCatalogSource, /title: "开业季"/);
    assert.match(contentPackCatalogSource, /idempotencyKey: "echoflow-ai-town:launch-core:0\.0\.1"/);
    assert.match(contentPackCatalogSource, /buildings: TOWN_BUILDING_CATALOG\.map/);
    assert.match(contentPackCatalogSource, /mainQuestChapters: Object\.keys\(TOWN_MAIN_QUEST_CATALOG\)\.map\(Number\)/);
    assert.match(contentPackCatalogSource, /festivals: TOWN_FESTIVAL_CATALOG\.map/);
    assert.match(contentPackCatalogSource, /export function createTownContentPackState/);
    assert.match(contentPackCatalogSource, /export function normalizeTownContentPackState/);
    assert.match(catalogIndexSource, /export \* from "\.\/town-content-pack\.catalog"/);
    assert.match(townSaveEntitySource, /contentPack\?: \{/);
    assert.match(townServiceSource, /contentPack: createTownContentPackState\(\)/);
    assert.match(townServiceSource, /nextWorldState\.contentPack = normalizeTownContentPackState\(worldState\?\.contentPack\)/);
    assert.match(upgradeSource, /TOWN_CONTENT_PACK_MANIFEST/);
    assert.match(upgradeSource, /content pack \$\{TOWN_CONTENT_PACK_MANIFEST\.id\}@\$\{TOWN_CONTENT_PACK_MANIFEST\.version\}/);
});

test("console content pack page exposes manifest coverage without write controls", () => {
    assert.match(townConsoleControllerSource, /@Get\("content-pack"\)/);
    assert.match(townConsoleControllerSource, /return this\.townService\.getContentPackOverview\(\)/);
    assert.match(townServiceSource, /async getContentPackOverview\(\)/);
    assert.match(townServiceSource, /saveDistribution/);
    assert.match(townServiceSource, /const normalizedSaves = saves\.map\(\(save\) => \(\{ save, worldState: this\.normalizeWorldState\(save\.worldState, save\.day\) \}\)\)/);
    assert.match(townServiceSource, /const saveDistribution = saves\.reduce/);
    assert.match(townServiceSource, /const contentPack = save\.worldState\?\.contentPack/);
    assert.doesNotMatch(townServiceSource, /const saveDistribution = normalizedSaves\.reduce/);
    assert.match(townServiceSource, /chapterDistribution/);
    assert.match(townServiceSource, /legacySaveCount/);
    assert.match(townConsoleServiceSource, /getTownContentPack\(\)/);
    assert.match(townConsoleServiceSource, /\/ai-town\/content-pack/);
    assert.match(townWebTypesSource, /export type TownContentPackOverview/);
    assert.match(townRoutesSource, /const TownContentPackPage = lazy\(\(\) => import\("\.\/pages\/console\/content-pack"\)\)/);
    assert.match(townRoutesSource, /title: "内容包"/);
    assert.match(townRoutesSource, /icon: "list-checks"/);
    assert.match(townRoutesSource, /path: "content-pack"/);
    assert.match(townConsoleContentPackSource, /getTownContentPack/);
    assert.match(townConsoleContentPackSource, /内容包运营/);
    assert.match(townConsoleContentPackSource, /存档内容包分布/);
    assert.match(townConsoleContentPackSource, /主线章节分布/);
    assert.match(townConsoleContentPackSource, /运营检查/);
    assert.match(townConsoleContentPackSource, /Table/);
    assert.doesNotMatch(townConsoleContentPackSource, /useMutation/);
    assert.doesNotMatch(townConsoleContentPackSource, /consoleHttpClient\.(post|put|delete)/);
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

test("retention hooks provide a visible and audited return reward", () => {
    assert.match(townSaveEntitySource, /reward\?: \{/);
    assert.match(townWebTypesSource, /reward\?: \{/);
    assert.match(townServiceSource, /private createRetentionReward\(completedProgressCount: number\)/);
    assert.match(townServiceSource, /reward: this\.createRetentionReward\(completedProgressCount\)/);
    assert.match(townServiceSource, /private consumeRetentionReward\(save: TownSave, action: TownActionDto\["action"\]\)/);
    assert.match(townServiceSource, /const retentionReward = this\.consumeRetentionReward\(save, dto\.action\)/);
    assert.match(townServiceSource, /if \(retention\.nextHook\.action !== action\) return null/);
    assert.match(townServiceSource, /coins: config\.coins \+ \(retentionReward\?\.coins \?\? 0\)/);
    assert.match(townServiceSource, /refs\.push\("rule:retention-reward"\)/);
    assert.match(townServiceSource, /回访金币/);
    assert.match(townServiceSource, /private formatRetentionReward/);
    assert.match(townGamePanelsSource, /if \(rule === "rule:retention-reward"\) return "回访奖励"/);
    assert.match(townGamePanelsSource, /formatRetentionReward\(retention\.nextHook\.reward\)/);
    assert.match(townGamePanelsSource, /formatRetentionReward\(goal\.retention\.nextHook\.reward\)/);
    assert.match(townStylesSource, /\.retention-plan-card em/);
});

test("retention reward has an actionable player CTA that matches the hook rule", () => {
    assert.match(townGamePanelsSource, /onRunRetentionAction\?: \(action: string\) => void/);
    assert.match(townGamePanelsSource, /const retentionActionState = retention \? getActionState\(save, retention\.nextHook\.action\) : null;/);
    assert.match(townGamePanelsSource, /const retentionActionLabel = retention \? getGoalActionLabel\(retention\.nextHook\.action, retention\.nextHook\.targetLabel\) : "";/);
    assert.match(townGamePanelsSource, /aria-label=\{`回访奖励：\$\{retentionActionLabel\}`\}/);
    assert.match(townGamePanelsSource, /retentionActionState\.canRun \? retentionActionLabel : retentionActionState\.disabledReason/);
    assert.match(townGamePanelsSource, /onClick=\{\(\) => onRunRetentionAction\?\.\(retention\.nextHook\.action\)\}/);
    assert.doesNotMatch(townGamePanelsSource, />领取回访奖励</);
    assert.match(townPageSource, /<TaskPanel save=\{save\}/);
    assert.match(townPageSource, /onRunRetentionAction=\{\(action\) => runAction\(action\)\}/);
    assert.match(townStylesSource, /\.retention-action-row/);
    assert.match(townReadmeSource, /回访奖励 CTA 显示匹配钩子的具体玩家动作/);
    assert.match(rootAgentsSource, /不要用“领取奖励”“领取回访奖励”等福利式泛称替代实际行动/);
});

test("long-term goals provide actionable CTAs instead of passive progress only", () => {
    assert.match(townGameRulesSource, /export function getGoalActionTarget\(save: TownSave, goalType: "quest" \| "weekly" \| "festival"\)/);
    assert.match(townGameRulesSource, /export function getGoalActionLabel\(action: string, targetLabel\?: string\)/);
    assert.match(townGameRulesSource, /requirement\.type === "building:restaurant"/);
    assert.match(townGameRulesSource, /return \{ action: "upgrade", buildingId: "restaurant", targetLabel: "暖光餐馆"/);
    assert.match(townGameRulesSource, /const festival = save\.worldState\.activeFestival/);
    assert.match(townGamePanelsSource, /onRunGoalAction\?: \(action: string, params\?: \{ buildingId\?: string \}\) => void/);
    assert.match(townGamePanelsSource, /const questAction = getGoalActionTarget\(save, "quest"\);/);
    assert.match(townGamePanelsSource, /const weeklyAction = getGoalActionTarget\(save, "weekly"\);/);
    assert.match(townGamePanelsSource, /const festivalAction = getGoalActionTarget\(save, "festival"\);/);
    assert.match(townGamePanelsSource, /function GoalActionButton/);
    assert.match(townGamePanelsSource, /const goalActionLabel = getGoalActionLabel\(goalAction\.action, goalAction\.targetLabel\)/);
    assert.match(townGamePanelsSource, /aria-label=\{`\$\{label\}：\$\{goalActionLabel\}`\}/);
    assert.match(townGamePanelsSource, /actionState\.canRun \? goalActionLabel : actionState\.disabledReason/);
    assert.doesNotMatch(townGamePanelsSource, />推进主线</);
    assert.doesNotMatch(townGamePanelsSource, />推进周目标</);
    assert.doesNotMatch(townGamePanelsSource, />筹备活动</);
    assert.doesNotMatch(townGamePanelsSource, /label="推进主线"|label="推进周目标"|label="筹备活动"/);
    assert.match(townGamePanelsSource, /onClick=\{\(\) => onRunGoalAction\?\.\(goalAction\.action, goalAction\.buildingId \? \{ buildingId: goalAction\.buildingId \} : undefined\)\}/);
    assert.match(townPageSource, /onRunGoalAction=\{\(action, params\) => runAction\(action, params\)\}/);
    assert.match(townStylesSource, /\.goal-action-row/);
    assert.match(townReadmeSource, /主线、周目标、活动和今日计划推荐 CTA 也必须显示具体玩家动作/);
    assert.match(rootAgentsSource, /不要用“执行任务”“处理目标”“推进主线”“推进周目标”或“筹备活动”等后台式或目标式泛称/);
});

test("daily task cards provide actionable CTAs instead of static checklist rows", () => {
    assert.match(townGameRulesSource, /export function getActionForTaskType\(type: string\): TownGoalActionTarget\["action"\]/);
    assert.match(townGamePanelsSource, /function getTaskActionTarget\(save: TownSave, task: TownSave\["worldState"\]\["dailyTasks"\]\[number\]\): TownGoalActionTarget \| null/);
    assert.match(townGamePanelsSource, /if \(task\.completed\) return null/);
    assert.match(townGamePanelsSource, /const action = getActionForTaskType\(task\.type\)/);
    assert.match(townGamePanelsSource, /function TaskActionButton/);
    assert.match(townGamePanelsSource, /<TaskActionButton key=\{task\.id\} onRunGoalAction=\{onRunGoalAction\} save=\{save\} task=\{task\} \/>/);
    assert.match(townGamePanelsSource, /const taskActionLabel = getGoalActionLabel\(target\.action, target\.targetLabel\)/);
    assert.match(townGamePanelsSource, /aria-label=\{`\$\{task\.title\}：\$\{taskActionLabel\}`\}/);
    assert.match(townGamePanelsSource, /actionState\.canRun \? taskActionLabel : actionState\.disabledReason/);
    assert.doesNotMatch(townGamePanelsSource, />执行任务</);
    assert.match(townGamePanelsSource, /onClick=\{\(\) => onRunGoalAction\?\.\(target\.action, target\.buildingId \? \{ buildingId: target\.buildingId \} : undefined\)\}/);
    assert.match(townStylesSource, /\.task-action-row/);
    assert.match(townReadmeSource, /不再使用“执行任务”“推进主线”“推进周目标”“筹备活动”这类后台式或目标式泛称/);
    assert.match(rootAgentsSource, /不要用“执行任务”“处理目标”“推进主线”“推进周目标”或“筹备活动”等后台式或目标式泛称/);
});

test("daily task cards feel like playable quest cards with rewards and action feedback", () => {
    assert.match(townGamePanelsSource, /task\.completed \? "task-card completed" : "task-card active"/);
    assert.match(townGamePanelsSource, /className="task-card-header"/);
    assert.match(townGamePanelsSource, /className="task-kicker"/);
    assert.match(townGamePanelsSource, /className="task-progress-orb"/);
    assert.match(townGamePanelsSource, /className="task-reward-strip" aria-label="任务奖励"/);
    assert.match(townGamePanelsSource, /className="game-primary task-action-button"/);
    assert.match(townGamePanelsSource, /className="task-action-copy"/);
    assert.match(townStylesSource, /\.task-card\.active/);
    assert.match(townStylesSource, /\.task-card-header/);
    assert.match(townStylesSource, /\.task-progress-orb/);
    assert.match(townStylesSource, /\.task-reward-strip/);
    assert.match(townStylesSource, /\.task-action-button/);
    assert.match(townStylesSource, /\.task-action-copy/);
    assert.match(townStylesSource, /@keyframes taskPulse/);
});

test("achievement empty state points players toward the first badge action", () => {
    assert.match(townGamePanelsSource, /const achievementAction = getGoalActionTarget\(save, "achievement"\);/);
    assert.match(townGamePanelsSource, /className="achievement-empty-card"/);
    assert.match(townGamePanelsSource, /<span>第一枚徽章<\/span>/);
    assert.match(townGamePanelsSource, /<strong>把今天的经营写进成就册<\/strong>/);
    assert.match(townGamePanelsSource, /完成委托、升级建筑或推进主线后，徽章会记录你的小镇风格。/);
    assert.match(townGamePanelsSource, /<GoalActionButton label="徽章行动" goalAction=\{achievementAction\} save=\{save\} onRunGoalAction=\{onRunGoalAction\} \/>/);
    assert.doesNotMatch(townGamePanelsSource, /完成长期目标后会在这里点亮成就/);
    assert.match(townStylesSource, /\.achievement-empty-card/);
    assert.match(townReadmeSource, /成就空态 \| ready \| 成就徽章无记录时展示第一枚徽章卡/);
    assert.match(rootAgentsSource, /经营游戏的结算、日志、任务或成就空态必须给出下一步玩家动作/);
});

test("earned achievements render as a badge board with a next badge action", () => {
    assert.match(townGamePanelsSource, /className="achievement-board"/);
    assert.match(townGamePanelsSource, /className="achievement-badge-card"/);
    assert.match(townGamePanelsSource, /className="achievement-stamp"/);
    assert.match(townGamePanelsSource, /<strong>\{item\}<\/strong>/);
    assert.match(townGamePanelsSource, /<small>已写入小镇成就册<\/small>/);
    assert.match(townGamePanelsSource, /className="achievement-next-card"/);
    assert.match(townGamePanelsSource, /<span>下一枚徽章<\/span>/);
    assert.match(townGamePanelsSource, /<GoalActionButton label="继续收集徽章" goalAction=\{achievementAction\} save=\{save\} onRunGoalAction=\{onRunGoalAction\} \/>/);
    assert.doesNotMatch(townGamePanelsSource, /<div className="achievement-list">\{achievements\.map\(\(item\) => <span key=\{item\}>\{item\}<\/span>\)\}<\/div>/);
    assert.match(townStylesSource, /\.achievement-board/);
    assert.match(townStylesSource, /\.achievement-badge-card/);
    assert.match(townStylesSource, /\.achievement-next-card/);
    assert.match(townReadmeSource, /成就徽章墙 \| ready \| 已获得成就展示为徽章墙/);
    assert.match(rootAgentsSource, /经营游戏的结算、日志、任务或成就空态必须给出下一步玩家动作/);
});

test("quest and weekly empty states stay actionable inside the task drawer", () => {
    assert.match(townGamePanelsSource, /className="quest-empty-card"/);
    assert.match(townGamePanelsSource, /<span>主线线索<\/span>/);
    assert.match(townGamePanelsSource, /<strong>先把今日委托跑起来<\/strong>/);
    assert.match(townGamePanelsSource, /经营、拜访或探索后，新的主线章节会从小镇日志里长出来。/);
    assert.match(townGamePanelsSource, /<GoalActionButton label="主线线索行动" goalAction=\{questAction\} save=\{save\} onRunGoalAction=\{onRunGoalAction\} \/>/);
    assert.match(townGamePanelsSource, /<span>本周路线<\/span>/);
    assert.match(townGamePanelsSource, /<strong>休息结算后刷新周目标<\/strong>/);
    assert.match(townGamePanelsSource, /今天先完成一次有效行动，再用休息结算开启下一段周路线。/);
    assert.match(townGamePanelsSource, /<GoalActionButton label="周路线行动" goalAction=\{weeklyAction\} save=\{save\} onRunGoalAction=\{onRunGoalAction\} \/>/);
    assert.doesNotMatch(townGamePanelsSource, /主线正在整理中/);
    assert.doesNotMatch(townGamePanelsSource, /本周目标会在休息后刷新/);
    assert.match(townStylesSource, /\.quest-empty-card/);
    assert.match(townReadmeSource, /目标空态 \| ready \| 主线和周目标无记录时展示路线卡/);
    assert.match(rootAgentsSource, /经营游戏的结算、日志、任务或成就空态必须给出下一步玩家动作/);
});

test("command bar feels like a game action deck with preview and budget feedback", () => {
    assert.match(townGamePanelsSource, /className=\{`command-card \$\{action\.recommended \? "recommended" : ""\}\$\{action\.taskLinked \? " task-linked" : ""\}\$\{!action\.canRun \? " blocked" : ""\}`\}/);
    assert.match(townGamePanelsSource, /className="command-card-topline"/);
    assert.match(townGamePanelsSource, /className="command-recommend-marker"/);
    assert.match(townGamePanelsSource, /className="command-preview"/);
    assert.match(townGamePanelsSource, /className="command-budget"/);
    assert.match(townGamePanelsSource, /action\.canRun \? action\.preview\[0\] \?\? action\.desc : action\.disabledReason/);
    assert.match(townGamePanelsSource, /aria-label=\{getCommandAriaLabel\(action\)\}/);
    assert.match(townGamePanelsSource, /function getCommandAriaLabel\(action: TownCommandViewModel\)/);
    assert.match(townGamePanelsSource, /action\.recommended \? "今日推荐" : ""/);
    assert.match(townGamePanelsSource, /action\.taskLinked \? "关联任务" : ""/);
    assert.match(townGamePanelsSource, /action\.preview\.join\(" · "\) \|\| action\.desc/);
    assert.match(townGamePanelsSource, /action\.canRun \? action\.hint : "行动受限"/);
    assert.match(townStylesSource, /\.command-card/);
    assert.match(townStylesSource, /\.command-card\.recommended/);
    assert.match(townStylesSource, /\.command-card\.blocked/);
    assert.match(townStylesSource, /\.command-card-topline/);
    assert.match(townStylesSource, /\.command-preview/);
    assert.match(townStylesSource, /\.command-budget/);
    assert.match(townStylesSource, /@keyframes commandGlow/);
    assert.match(townReadmeSource, /首屏命令牌 \| ready \| 底部行动栏以游戏命令牌展示推荐、任务关联、收益预览、预算提示和 blocked 态/);
    assert.match(townReadmeSource, /并把推荐、任务关联、预览和受限原因合并进按钮可访问名称/);
    assert.match(rootAgentsSource, /命令牌按钮的可访问名称必须合并动作名、推荐状态、任务关联、收益预览、预算提示和不可行动原因/);
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

test("town event log reads as a story timeline instead of a plain card grid", () => {
    assert.match(townGamePanelsSource, /className="event-list game-event-list event-storybook"/);
    assert.match(townGamePanelsSource, /className="event-history-title"/);
    assert.match(townGamePanelsSource, /<span>小镇故事册<\/span>/);
    assert.match(townGamePanelsSource, /<strong>\{group\.title\}<\/strong>/);
    assert.match(townGamePanelsSource, /className="event-history-timeline"/);
    assert.match(townGamePanelsSource, /className=\{`event-timeline-entry event-\$\{event\.type\}`\}/);
    assert.match(townGamePanelsSource, /className="event-timeline-node"/);
    assert.match(townGamePanelsSource, /className="event-timeline-card"/);
    assert.match(townGamePanelsSource, /className="event-timeline-meta"/);
    assert.match(townGamePanelsSource, /className="event-result-inline"/);
    assert.doesNotMatch(townGamePanelsSource, /className="event-history-grid"/);
    assert.match(townStylesSource, /\.event-storybook/);
    assert.match(townStylesSource, /\.event-history-timeline/);
    assert.match(townStylesSource, /\.event-timeline-entry/);
    assert.match(townStylesSource, /\.event-timeline-entry::before/);
    assert.match(townStylesSource, /\.event-timeline-node/);
    assert.match(townStylesSource, /\.event-timeline-card/);
    assert.match(townReadmeSource, /小镇日志 \| ready \| 日志抽屉以故事册时间线展示事件/);
    assert.match(rootAgentsSource, /经营游戏的日志或历史记录应优先呈现为故事册、时间线或章节回放/);
});

test("settlement empty state is an actionable night ledger", () => {
    assert.match(townPageSource, /<SettlementPanel save=\{save\} onRest=\{\(\) => runAction\("rest"\)\} \/>/);
    assert.match(townGamePanelsSource, /export function SettlementPanel\(\{ onRest, save \}: \{ onRest\?: \(\) => void; save: TownSave \}\)/);
    assert.match(townGamePanelsSource, /className="settlement-empty-card"/);
    assert.match(townGamePanelsSource, /<span>夜间账本<\/span>/);
    assert.match(townGamePanelsSource, /<strong>今天还没有日结<\/strong>/);
    assert.match(townGamePanelsSource, /经营、拜访或探索后，可以休息结算，把收入、维护、声望和第二天目标写进小镇。/);
    assert.match(townGamePanelsSource, /<Button type="button" variant="default" className="game-primary" onClick=\{onRest\}>休息结算<\/Button>/);
    assert.doesNotMatch(townGamePanelsSource, /休息一天后会在这里显示每日结算/);
    assert.match(townStylesSource, /\.settlement-empty-card/);
    assert.match(townReadmeSource, /日结空态 \| ready \| 每日结算抽屉无历史结算时展示夜间账本和休息结算入口/);
    assert.match(rootAgentsSource, /经营游戏的结算、日志、任务或成就空态必须给出下一步玩家动作/);
});

test("completed actions surface as a game reward toast instead of a plain resource strip", () => {
    assert.match(townGamePanelsSource, /export function RewardToast\(\{ event \}: \{ event: TownEvent \}\)/);
    assert.match(townGamePanelsSource, /className="reward-toast" role="status" aria-live="polite" aria-atomic="true"/);
    assert.match(townGamePanelsSource, /className="reward-toast-kicker"/);
    assert.match(townGamePanelsSource, /className="reward-toast-title"/);
    assert.match(townGamePanelsSource, /className="reward-toast-summary"/);
    assert.match(townGamePanelsSource, /<ResultBar event=\{event\} \/>/);
    assert.match(townGamePanelsSource, /getResultSummary\(event\)/);
    assert.match(townPageSource, /<RewardToast event=\{visibleResultEvent\} \/>/);
    assert.match(townStylesSource, /\.reward-toast/);
    assert.match(townStylesSource, /\.reward-toast-kicker/);
    assert.match(townStylesSource, /\.reward-toast-title/);
    assert.match(townStylesSource, /\.reward-toast-summary/);
    assert.match(townStylesSource, /@keyframes rewardPop/);
    assert.match(townReadmeSource, /行动反馈 \| ready \| 行动完成后会弹出带 status 语义的奖励结算浮层，展示事件标题、玩家可读总结和资源变化/);
    assert.match(rootAgentsSource, /行动完成后的即时反馈必须像游戏奖励结算/);
    assert.match(rootAgentsSource, /奖励、结算、升级或任务完成反馈必须具备可感知状态语义/);
});

test("pending actions surface as concrete in-world command feedback", () => {
    assert.match(townPageSource, /function ActionPendingBanner\(\{ action, characterName \}: \{ action\?: string; characterName\?: string \}\)/);
    assert.match(townPageSource, /const pendingAction = actionMutation\.isPending \? actionMutation\.variables\?\.action : chatMutation\.isPending \? "chat" : undefined;/);
    assert.match(townPageSource, /<ActionPendingBanner action=\{pendingAction\} characterName=\{activeCharacter\?\.name\} \/>/);
    assert.match(townPageSource, /className="action-pending-banner" role="status" aria-live="polite"/);
    assert.match(townPageSource, /<p className="game-error" role="alert">\{errorMessage\}<\/p>/);
    assert.match(townPageSource, /<div className="game-toast error" role="alert" aria-live="assertive">\{errorMessage\}<\/div>/);
    assert.match(townPageSource, /return "小镇行动未完成，请稍后再试。";/);
    assert.doesNotMatch(townPageSource, /操作失败，请稍后再试/);
    assert.match(townPageSource, /function getPendingActionCopy\(action\?: string, characterName\?: string\)/);
    assert.match(townPageSource, /case "operate": return \{ label: "经营餐馆中", detail: "厨房正在结算金币、体力和今日任务。" \};/);
    assert.match(townPageSource, /case "visit": return \{ label: "拜访居民中", detail: "关系、记忆约定和居民回应正在写入小镇。" \};/);
    assert.match(townPageSource, /case "advice": return \{ label: "镇务排班中", detail: "参谋正在读取资源、任务和记忆线索。" \};/);
    assert.match(townPageSource, /case "rest": return \{ label: "休息结算中", detail: "日结、行动刷新和第二天目标正在排布。" \};/);
    assert.match(townPageSource, /case "chat": return \{ label: characterName \? `和\$\{characterName\}交流中` : "和居民交流中", detail: "居民回复会参考关系、记忆和今天的行动。" \};/);
    assert.doesNotMatch(townPageSource, /目标正在生成/);
    assert.doesNotMatch(townPageSource, /处理中/);
    assert.doesNotMatch(townPageSource, /加载中/);
    assert.match(townStylesSource, /\.action-pending-banner/);
    assert.match(townStylesSource, /\.action-pending-banner::before/);
    assert.match(townStylesSource, /@keyframes pendingSignal/);
    assert.match(townReadmeSource, /行动等待反馈 \| ready \| 行动或居民交流提交后在主场景边缘展示具体小镇命令状态/);
    assert.match(townReadmeSource, /错误反馈 \| ready \| 用户端行动错误使用小镇语境/);
    assert.match(rootAgentsSource, /行动、生成或居民交流等待态必须显示具体玩家动作和业务对象/);
    assert.match(rootAgentsSource, /经营游戏用户端错误反馈必须使用玩法语境和可感知 alert 语义/);
});

test("game motion respects reduced motion without removing visual feedback", () => {
    assert.doesNotMatch(townGamePanelsSource, /framer-motion/);
    assert.doesNotMatch(townGamePanelsSource, /useReducedMotion/);
    assert.doesNotMatch(townGamePanelsSource, /shouldReduceMotion/);
    assert.match(townStylesSource, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(townStylesSource, /\.floating-result,\s*\.command-card\.recommended,\s*\.building-hotspot\.recommended::before,\s*\.npc-hotspot\.recommended::before,\s*\.task-card\.active::before,\s*\.action-pending-banner::before,\s*\.ai-companion\.scheduling\s*\{[\s\S]*animation: none/);
    assert.doesNotMatch(townStylesSource, /ai-companion\.thinking/);
    assert.doesNotMatch(townGamePanelsSource, /ai-companion thinking/);
    assert.match(townStylesSource, /\.floating-result\s*\{[\s\S]*opacity: 1;[\s\S]*transform: translateX\(-50%\);/);
    assert.match(townStylesSource, /\.command-card:hover:not\(:disabled\)\s*\{[\s\S]*transform: none;/);
    assert.match(townReadmeSource, /参谋排班态/);
    assert.doesNotMatch(townReadmeSource, /参谋思考态/);
    assert.match(rootAgentsSource, /游戏化 UI 的奖励、推荐、热点、任务、抽屉和弹层动效必须支持 prefers-reduced-motion/);
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

test("town companion exposes playable recommendation context before opening advice drawer", () => {
    assert.match(townGamePanelsSource, /AiCompanion\(\{ save, goal, pending, onOpenAdvice \}/);
    assert.match(townPageSource, /<AiCompanion save=\{save\} goal=\{viewModel\.goal\}/);
    assert.match(townGamePanelsSource, /const recommendedAction = getRecommendedAction\(save, getRecommendedTarget\(save\)\);/);
    assert.match(townGamePanelsSource, /const recommendedActionLabel = recommendedAction \? getGoalActionLabel\(recommendedAction, goal\.primary\.title\) : "查看今日计划";/);
    assert.match(townGamePanelsSource, /const recommendedState = recommendedAction \? getActionState\(save, recommendedAction\) : null;/);
    assert.match(townGamePanelsSource, /className="companion-recommendation"/);
    assert.match(townGamePanelsSource, /<span>下一步<\/span>/);
    assert.match(townGamePanelsSource, /<strong>\{recommendedActionLabel\}<\/strong>/);
    assert.match(townGamePanelsSource, /<small>\{recommendedState\?\.canRun \? companionPreview : recommendedState\?\.disabledReason \?\? goal\.primary\.desc\}<\/small>/);
    assert.match(townGamePanelsSource, /className="companion-memory-chip"/);
    assert.match(townGamePanelsSource, /<strong>\{pending \? "镇务排班中" : "镇务参谋"\}<\/strong>/);
    assert.doesNotMatch(townGamePanelsSource, /思考中\.\.\./);
    assert.match(townGamePanelsSource, /待回应约定 \{goal\.memoryPromiseCount\}/);
    assert.match(townGamePanelsSource, /aria-label=\{`镇务参谋：\$\{recommendedActionLabel\}，\$\{companionPreview\}`\}/);
    assert.match(townStylesSource, /width: min\(460px, calc\(100% - 48px\)\);/);
    assert.match(townStylesSource, /\.companion-recommendation/);
    assert.match(townStylesSource, /\.companion-memory-chip/);
    assert.match(townStylesSource, /@media \(max-width: 720px\)\s*\{[\s\S]*\.ai-companion\s*\{[\s\S]*flex-wrap: wrap;/);
    assert.match(townStylesSource, /@media \(max-width: 720px\)\s*\{[\s\S]*\.companion-recommendation\s*\{[\s\S]*width: 100%;[\s\S]*border-left: 0;/);
    assert.match(townReadmeSource, /参谋 HUD \| ready \| 镇务参谋入口在打开今日计划前先展示下一步玩家动作、收益预览和待回应约定数/);
    assert.match(townReadmeSource, /等待态使用镇务排班中而不是思考中/);
    assert.match(rootAgentsSource, /镇务参谋或 AI 助手入口不能只是打开生成面板/);
    assert.match(rootAgentsSource, /镇务参谋等待态应使用镇务排班中、整理今日计划等业务动作/);
});

test("npc dialogue feels like a playable resident scene instead of a plain form", () => {
    assert.match(townGamePanelsSource, /function createNpcConversationPrompts\(character: TownCharacter \| null\)/);
    assert.match(townGamePanelsSource, /activeCharacter\.memory\?\.promises/);
    assert.match(townGamePanelsSource, /activeCharacter\.memory\?\.preferences/);
    assert.match(townGamePanelsSource, /activeCharacter\.memory\?\.keyMoments/);
    assert.match(townGamePanelsSource, /className="avatar-image npc-fallback-avatar" aria-hidden="true"/);
    assert.match(townGamePanelsSource, /className="npc-profile-avatar npc-fallback-avatar" aria-hidden="true"/);
    assert.match(townGamePanelsSource, /className="npc-hotspot-avatar npc-fallback-avatar" aria-hidden="true"/);
    assert.match(townGamePanelsSource, /className="ai-companion-avatar npc-fallback-avatar" aria-hidden="true"/);
    assert.match(townGamePanelsSource, /className="ai-confirm-avatar npc-fallback-avatar" aria-hidden="true"/);
    assert.match(townGamePanelsSource, /className="strategy-avatar npc-fallback-avatar" aria-hidden="true"/);
    assert.doesNotMatch(townGamePanelsSource, /fallback=\{<span className="avatar">/);
    assert.doesNotMatch(townGamePanelsSource, /fallback=\{<span>\{character\.name\.slice\(0, 1\)\}<\/span>\}/);
    assert.doesNotMatch(townGamePanelsSource, /fallback=\{<span>参谋<\/span>\}/);
    assert.match(townGamePanelsSource, /"npc-dialogue-prompts memory-driven" : "npc-dialogue-prompts"/);
    assert.match(townGamePanelsSource, /className="dialogue-prompt-chip"/);
    assert.match(townGamePanelsSource, /onClick=\{\(\) => setChatText\(prompt\.message\)\}/);
    assert.match(townGamePanelsSource, /className="npc-conversation-composer"/);
    assert.match(townGamePanelsSource, /const dialoguePlaceholder = activeCharacter \? `给\$\{activeCharacter\.name\}留一句今天的小镇话题` : "先选择一位居民";/);
    assert.match(townGamePanelsSource, /placeholder=\{dialoguePlaceholder\}/);
    assert.match(townGamePanelsSource, /aria-label=\{activeCharacter \? `给\$\{activeCharacter\.name\}写一句话` : "选择居民后写一句话"\}/);
    assert.match(townGamePanelsSource, /aria-label=\{activeCharacter \? `和\$\{activeCharacter\.name\}聊天` : "先选择居民"\}/);
    assert.match(townGamePanelsSource, /\{activeCharacter \? pending \? `等\$\{activeCharacter\.name\}回应` : `和\$\{activeCharacter\.name\}聊天` : "先选择居民"\}/);
    assert.doesNotMatch(townGamePanelsSource, />\{pending \? "交流中\.\.\." : "和居民聊天"\}<\/Button>/);
    assert.match(townGamePanelsSource, /className="npc-reply-bubble"/);
    assert.match(townGamePanelsSource, /className="npc-empty-bubble"/);
    assert.match(townStylesSource, /\.npc-dialogue-prompts/);
    assert.match(townStylesSource, /\.dialogue-prompt-chip/);
    assert.match(townStylesSource, /\.npc-reply-bubble/);
    assert.match(townStylesSource, /\.npc-empty-bubble/);
    assert.match(townStylesSource, /\.npc-fallback-avatar/);
    assert.match(townStylesSource, /\.npc-hotspot-avatar\.npc-fallback-avatar/);
    assert.match(townStylesSource, /\.ai-companion-avatar\.npc-fallback-avatar,\s*\.ai-confirm-avatar\.npc-fallback-avatar,\s*\.strategy-avatar\.npc-fallback-avatar/);
    assert.match(townReadmeSource, /居民对话舞台 \| ready \| 对话面板提供记忆\/偏好\/约定驱动的快捷话题、角色回复气泡、居民化输入占位、带居民名的可见聊天按钮和明确的聊天按钮可访问名称/);
    assert.match(townReadmeSource, /居民头像兜底 \| ready \| 居民图片加载失败时，居民列表、居民详情和地图热点仍使用小镇居民头像样式/);
    assert.match(townReadmeSource, /镇务参谋入口、额度提示和今日计划参谋头像也使用业务化占位/);
    assert.match(rootAgentsSource, /居民或 NPC 对话不能退化成普通表单/);
    assert.match(rootAgentsSource, /居民、角色、伙伴、参谋或关键 NPC 图片加载失败时，fallback 必须继续使用业务角色样式/);
    assert.match(rootAgentsSource, /覆盖列表、地图热点、HUD、确认卡和策略面板等首屏路径/);
    assert.match(rootAgentsSource, /对话输入区必须说明正在给谁写话题/);
    assert.match(rootAgentsSource, /对话提交按钮的可见文本也必须带当前对象或等待对象/);
});

test("npc dialogue state stays attached to the current resident", () => {
    assert.match(townPageSource, /function selectNpc\(character: TownCharacter\)/);
    assert.match(townPageSource, /setActiveCharacter\(character\);[\s\S]*setLastReply\(""\);[\s\S]*setChatText\(""\);/);
    assert.match(townPageSource, /const updatedCharacter = result\.save\.characters\.find\(\(character\) => character\.id === activeCharacter\?\.id\)/);
    assert.match(townPageSource, /if \(updatedCharacter\) setActiveCharacter\(updatedCharacter\);/);
    assert.match(townPageSource, /setChatText\(""\);[\s\S]*setScene\("npc"\);/);
    assert.match(townPageSource, /onClick=\{\(\) => selectNpc\(character\.character\)\}/);
    assert.match(townPageSource, /setActiveCharacter=\{selectNpc\}/);
    assert.match(townReadmeSource, /对话状态 \| ready \| 切换居民会清空旧输入和旧回复，聊天成功后会同步最新居民记忆/);
    assert.match(rootAgentsSource, /切换居民或 NPC 时必须清空上一位角色的输入和回复/);
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
    assert.doesNotMatch(townViewModelSource, /TownEventSummaryViewModel/);
    assert.doesNotMatch(townViewModelSource, /events: save\.events\.map/);
    assert.match(townPageSource, /const viewModel = save \? createTownViewModel\(save\) : null;/);
    assert.match(townPageSource, /const actionState = save \? getActionState\(save, action, params\?\.buildingId\) : null;/);
    assert.match(townPageSource, /<CompactGoalBoard goal=\{viewModel\.goal\} save=\{save\}/);
    assert.match(townPageSource, /<CommandSummary commands=\{viewModel\.commands\} pending=\{actionMutation\.isPending\}/);
});

test("compact goal board turns festival absence into a playable clue", () => {
    assert.match(townGamePanelsSource, /export function CompactGoalBoard\(\{ goal, save, onOpenEvents, onOpenSettlement, onOpenTasks \}: \{ goal: TownGoalViewModel; save: TownSave;/);
    assert.match(townGamePanelsSource, /const festival = save\.worldState\.activeFestival;/);
    assert.match(townGamePanelsSource, /const festivalLabel = festival \? formatFestivalStatus\(festival\.status\) : "活动线索";/);
    assert.match(townGamePanelsSource, /const festivalTitle = festival \? festival\.title : "探索街区";/);
    assert.match(townGamePanelsSource, /const festivalHint = festival \? `剩余 \$\{festival\.daysLeft\} 天 · 金币 \$\{festival\.reward\.coins \?\? 0\} · 声望 \$\{festival\.reward\.reputation \?\? 0\}` : "打开委托册找下一条活动线索";/);
    assert.match(townGamePanelsSource, /aria-label=\{festival \? `小镇活动：\$\{festival\.title\}，\$\{festivalHint\}` : "活动线索：探索街区，打开委托册找下一条活动线索"\}/);
    assert.match(townGamePanelsSource, /className="goal-chip mini festival-clue"/);
    assert.match(townGamePanelsSource, /onClick=\{onOpenTasks\}/);
    assert.match(townGamePanelsSource, /<span>追踪线索<\/span>/);
    assert.doesNotMatch(townGamePanelsSource, /等待活动线索/);
    assert.match(townStylesSource, /\.goal-chip\.festival-clue/);
    assert.match(townReadmeSource, /活动线索 \| ready \| 首屏目标板在无活动时展示探索街区和追踪线索入口/);
    assert.match(rootAgentsSource, /经营游戏首屏目标板中的活动、赛季或限时事件入口不能只写等待线索/);
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

test("event choices render as playable branch cards", () => {
    assert.match(townGamePanelsSource, /function getChoiceAriaLabel\(choice: NonNullable<TownEvent\["choices"\]>\[number\], actionState: ReturnType<typeof getActionState>\)/);
    assert.match(townGamePanelsSource, /const choiceClassName = `event-choice-card choice-\$\{getChoiceTone\(choice\.id\)\}\$\{!actionState\.canRun \? " blocked" : ""\}`;/);
    assert.match(townGamePanelsSource, /aria-label=\{getChoiceAriaLabel\(choice, actionState\)\}/);
    assert.match(townGamePanelsSource, /<span className="choice-kicker">分支选择<\/span>/);
    assert.match(townGamePanelsSource, /<span className="choice-preview-chip" key=\{item\}>\{item\}<\/span>/);
    assert.match(townStylesSource, /\.event-choice-card/);
    assert.match(townStylesSource, /\.event-choice-card\.blocked/);
    assert.match(townStylesSource, /\.choice-kicker/);
    assert.match(townReadmeSource, /事件分支 \| ready \| 事件选择以分支行动牌展示/);
    assert.match(rootAgentsSource, /经营游戏的事件分支、剧情选择或行动选项应呈现为可执行分支牌/);
});

test("web copy keeps player-facing AI wording restrained", () => {
    assert.doesNotMatch(townPageSource, />AI乐园小镇</);
    assert.doesNotMatch(townPageSource, /EchoflowAI H5 Game/);
    assert.doesNotMatch(townGameRulesSource, /居民与 AI/);
    assert.doesNotMatch(townGameRulesSource, /advice: "AI 建议"/);
    assert.doesNotMatch(townGamePanelsSource, /智能事件/);
    assert.doesNotMatch(townGamePanelsSource, /使用智能建议/);
    assert.doesNotMatch(townGamePanelsSource, /智能建议/);
    assert.doesNotMatch(townGamePanelsSource, /AI\s*生成/);
    assert.doesNotMatch(townGamePanelsSource, /"小镇 AI"/);
    assert.doesNotMatch(townGamePanelsSource, /管理员配置的模型生成/);
    assert.doesNotMatch(townGamePanelsSource, /生成今日计划/);
    assert.doesNotMatch(townGamePanelsSource, /参谋生成/);
    assert.doesNotMatch(townServiceSource, /参谋生成了事件内容/);
    assert.doesNotMatch(townServiceSource, /参谋使用本地规则补位/);
    assert.match(townServiceSource, /context\.modelAssisted\) notes\.push\(context\.fallbackUsed \? "参谋按规则补位" : "参谋参与本次镇务"\)/);
    assert.match(townGamePanelsSource, /安排计划前会提示镇务额度，参谋会参考当前资源、任务和记忆约定安排下一步。/);
    assert.match(townGamePanelsSource, /和居民聊前会提示镇务额度，居民回应会参考当前关系、记忆和今日行动。/);
    assert.doesNotMatch(townGamePanelsSource, /确认后可能消耗额度/);
    assert.match(townGamePanelsSource, /镇务参谋会按当前资源、任务和记忆约定安排下一步。/);
    assert.match(townGamePanelsSource, /参谋参与/);
    assert.match(townGamePanelsSource, /: "镇务额度"/);
    assert.match(townReadmeSource, /用户端 AI 文案 \| 用户端把模型能力表述为镇务参谋、今日计划、居民回复、规则补位等玩法语境/);
    assert.match(townReadmeSource, /用户端事件审计和账务 chip 只展示参谋参与、规则补位或镇务额度/);
    assert.match(townReadmeSource, /不使用生成内容、模型输出、小镇 AI 或 fallback 这类工具式文案/);
    assert.match(rootAgentsSource, /用户端 AI 相关文案必须落到业务语境、玩法语境和可验证规则/);
    assert.match(rootAgentsSource, /用户端事件审计、行动日志或结果说明不得使用“生成内容”“模型输出”“fallback”“本地规则”等工具或运维措辞/);
    assert.match(rootAgentsSource, /使用镇务额度、居民聊天额度、探索导演额度等业务语境兜底/);
    assert.match(rootAgentsSource, /“小镇 AI”等泛 AI 标签/);
    assert.doesNotMatch(townConsoleAiConfigSource, /用户侧不暴露模型选择，只提示 AI 生成可能消耗额度/);
    assert.match(townConsoleAiConfigSource, /用户侧不暴露模型选择，只提示参谋安排和居民回应可能消耗额度/);
    assert.match(townGameRulesSource, /居民与参谋/);
    assert.match(townGameRulesSource, /advice: "今日计划"/);
    assert.match(townGamePanelsSource, /安排今日计划/);
    assert.match(townPageSource, />乐园小镇</);
});

test("ai usage confirmation matches the player action context", () => {
    assert.match(townGamePanelsSource, /type AiUsageConfirmKind = "advice" \| "chat"/);
    assert.match(townPageSource, /type PendingAiAction = \{ type: "advice" \} \| \{ type: "chat"; characterName: string \} \| null;/);
    assert.match(townPageSource, /confirmAiUsage\(\{ type: "chat", characterName: activeCharacter\.name \}\)/);
    assert.match(townPageSource, /<AiUsageConfirmCard kind=\{pendingAiAction\?\.type \?\? "advice"\} characterName=\{pendingAiAction\?\.type === "chat" \? pendingAiAction\.characterName : undefined\}/);
    assert.match(townGamePanelsSource, /AiUsageConfirmCard\(\{ kind = "advice", characterName, onAccept, onCancel \}/);
    assert.match(townGamePanelsSource, /const residentLabel = characterName \?\? "居民";/);
    assert.match(townGamePanelsSource, /const copy = kind === "chat"/);
    assert.match(townGamePanelsSource, /title: `和\$\{residentLabel\}继续聊`/);
    assert.match(townGamePanelsSource, /desc: `和\$\{residentLabel\}聊前会提示镇务额度，居民回应会参考当前关系、记忆和今日行动。`/);
    assert.match(townGamePanelsSource, /actionLabel: `和\$\{residentLabel\}聊`/);
    assert.match(townGamePanelsSource, /title: "安排今日计划"/);
    assert.match(townGamePanelsSource, /desc: "安排计划前会提示镇务额度，参谋会参考当前资源、任务和记忆约定安排下一步。"/);
    assert.match(townGamePanelsSource, /actionLabel: "安排计划"/);
    assert.match(townGamePanelsSource, /cancelLabel: "先留在小镇"/);
    assert.match(townGamePanelsSource, /aria-label=\{copy\.actionLabel\}/);
    assert.match(townGamePanelsSource, /aria-label=\{copy\.cancelLabel\}/);
    assert.match(townGamePanelsSource, />\{copy\.actionLabel\}<\/Button>/);
    assert.match(townGamePanelsSource, />\{copy\.cancelLabel\}<\/Button>/);
    assert.doesNotMatch(townGamePanelsSource, />继续<\/Button>/);
    assert.doesNotMatch(townGamePanelsSource, />暂不使用<\/Button>/);
    assert.doesNotMatch(townGamePanelsSource, /title: "和居民继续聊"/);
    assert.doesNotMatch(townGamePanelsSource, /actionLabel: "和居民聊"/);
    assert.match(townReadmeSource, /额度提示 \| ready \| 今日计划和居民回复共用额度确认，文案按触发场景区分且不暴露管理员配置或模型生成；居民聊天确认会带当前居民名/);
    assert.match(rootAgentsSource, /用户端额度提示、付费确认和生成确认也必须使用业务语境和玩家动作/);
    assert.match(rootAgentsSource, /居民聊天额度确认必须延续当前居民名/);
});

test("empty save state opens as a playable town scene", () => {
    assert.match(townPageSource, /className="game-stage onboarding-stage"/);
    assert.match(townPageSource, /ASSETS\.backgrounds\.town/);
    assert.match(townPageSource, /queryFn: listTownSaves,\s*retry: false,/);
    assert.match(readFileSync(new URL("../src/web/services/web/town.ts", import.meta.url), "utf8"), /apiHttpClient\.get<TownSaveListResult>\("\/ai-town\/saves", \{ silent: true \}\)/);
    assert.match(townPageSource, /onboarding-hotspots/);
    assert.match(townPageSource, /className="onboarding-quest-card"/);
    assert.match(townPageSource, /开张路线/);
    assert.match(townPageSource, /先经营餐馆/);
    assert.match(townPageSource, /再拜访居民/);
    assert.match(townPageSource, /最后休息结算/);
    assert.match(townPageSource, /完成后会留下关系、约定和第二天目标。/);
    assert.match(townStylesSource, /\.onboarding-quest-card/);
    assert.match(townStylesSource, /\.onboarding-quest-steps/);
    assert.match(townPageSource, /onboarding-command-preview/);
    assert.match(townPageSource, /const onboardingCommands = \[/);
    assert.match(townPageSource, /\{ label: "经营", hint: "餐馆开张", preview: "金币 \+20 · 今日任务" \}/);
    assert.match(townPageSource, /onboardingCommands\.map\(\(command\) => <span className="onboarding-command-card" aria-label=\{`\$\{command\.label\}：\$\{command\.hint\}，\$\{command\.preview\}`\}/);
    assert.match(townPageSource, /<strong>\{command\.label\}<\/strong>/);
    assert.match(townPageSource, /<small>\{command\.hint\}<\/small>/);
    assert.match(townPageSource, /<em>\{command\.preview\}<\/em>/);
    assert.match(townStylesSource, /\.onboarding-command-card/);
    assert.match(townReadmeSource, /开局命令预览 \| ready \| 首屏降级时命令预览以行动牌展示经营、拜访、布置、探索和休息的用途、收益或解锁提示/);
    assert.match(rootAgentsSource, /经营游戏降级首屏的命令预览不能只是静态词条/);
    assert.match(townPageSource, /npc-preview-avatar/);
    assert.match(townPageSource, /const townServiceAvailable = !savesQuery\.isError/);
    assert.match(townPageSource, /disabled=\{createMutation\.isPending \|\| !townServiceAvailable\}/);
    assert.match(townPageSource, /开张小镇/);
    assert.doesNotMatch(townPageSource, /"创建小镇"/);
    assert.match(townPageSource, /小镇开张中/);
    assert.match(townPageSource, /等待镇务服务/);
    assert.match(townPageSource, /开张后直接开始经营、拜访和探索。/);
    assert.doesNotMatch(townPageSource, /进入后直接开始经营、拜访和探索。/);
    assert.match(townPageSource, /正在翻看旧存档/);
    assert.match(townPageSource, /重试连接/);
    assert.match(townPageSource, /重连镇务中/);
    assert.match(townPageSource, /onClick=\{\(\) => void savesQuery\.refetch\(\)\}/);
    assert.match(townPageSource, /className="onboarding-service-card"/);
    assert.match(townPageSource, /className="onboarding-service-note" role="status" aria-live="polite"/);
    assert.doesNotMatch(townPageSource, /<div className="onboarding-service-note" role="status"/);
    assert.match(townPageSource, /镇务服务暂时未连接，仍可预览小镇场景和今日命令；请重试连接后开张或回到旧档。/);
    assert.doesNotMatch(townPageSource, /创建或读取存档/);
    assert.match(townStylesSource, /\.onboarding-service-note/);
    assert.match(townStylesSource, /\.onboarding-service-card/);
    assert.match(townStylesSource, /\.onboarding-retry/);
    assert.doesNotMatch(townPageSource, /旧存档加载失败，请刷新后重试。/);
    assert.doesNotMatch(townPageSource, /创建中\.\.\./);
    assert.doesNotMatch(townPageSource, /正在读取旧存档\.\.\./);
    assert.doesNotMatch(townPageSource, /连接中\.\.\./);
    assert.match(townReadmeSource, /首屏降级 \| ready \| Web API 或旧存档列表暂不可用时仍展示可玩的场景预览、HUD、热点和命令预览/);
    assert.match(townReadmeSource, /主 CTA 使用开张小镇/);
    assert.match(townReadmeSource, /服务异常说明使用开张或回到旧档/);
    assert.match(townReadmeSource, /首屏加载态使用小镇开张中、正在翻看旧存档和重连镇务中/);
    assert.match(townReadmeSource, /开局任务板 \| ready \| 首屏展示三步开张路线、奖励\/记忆卖点和服务状态/);
    assert.match(rootAgentsSource, /经营游戏首屏在 Web API 或旧存档列表暂不可用时仍应展示可玩的场景预览/);
    assert.match(rootAgentsSource, /经营游戏新手首屏必须给出一屏内可理解的第一分钟目标/);
    assert.match(rootAgentsSource, /经营游戏首屏创建、恢复存档和重连服务的加载态也必须写成玩法对象/);
    assert.match(rootAgentsSource, /经营游戏新存档主 CTA 应写成开张、启程、经营等玩家动作/);
    assert.match(rootAgentsSource, /服务异常说明也应使用开张、回到旧档、恢复小镇等玩家语境/);
    assert.match(rootAgentsSource, /不可用的创建、生成或行动入口应转为等待态、重试命令或明确不可行动原因/);
    assert.doesNotMatch(townPageSource, /game-title-screen/);
    assert.doesNotMatch(townPageSource, /ASSETS\.cover/);
    assert.doesNotMatch(townPageSource, /className="avatar"/);
});

test("mobile town layout keeps flow HUD content scrollable inside the embedded stage", () => {
    assert.match(townStylesSource, /@media \(max-width: 980px\)\s*\{[\s\S]*\.game-stage\s*\{[\s\S]*overflow-y: auto;[\s\S]*overflow-x: hidden;/);
    assert.match(townStylesSource, /@media \(max-width: 980px\)\s*\{[\s\S]*\.compact-goal-board,\s*\.command-summary,\s*\.scene-director\s*\{[\s\S]*position: static;/);
    assert.match(townStylesSource, /@media \(max-width: 720px\)\s*\{[\s\S]*\.game-drawer\s*\{[\s\S]*max-height: min\(82vh, 720px\);/);
    assert.match(townReadmeSource, /移动端嵌入布局 \| ready \| 小屏下目标板、命令牌和场景提示进入流式布局，舞台允许纵向滚动/);
    assert.match(rootAgentsSource, /移动端把 HUD、目标、命令或提示转为流式布局时，舞台容器必须允许纵向滚动/);
});

test("scene director turns actions into distinct playable backdrops", () => {
    assert.match(townAssetsSource, /kitchen: asset\("\/assets\/game-bg-kitchen\.png"\)/);
    assert.match(townAssetsSource, /npc: asset\("\/assets\/screenshot-npc\.png"\)/);
    assert.match(townAssetsSource, /night: asset\("\/assets\/screenshot-night-event\.png"\)/);
    assert.match(townGameRulesSource, /eventType === "explore" \|\| eventType === "unlock" \|\| eventType === "festival" \|\| eventType === "rest"/);
    assert.match(townPageSource, /const scenePresentation = getScenePresentation\(scene, latestEvent, selectedBuilding, activeCharacter\)/);
    assert.match(townPageSource, /className=\{`game-stage scene-\$\{scene\}`\}/);
    assert.match(townPageSource, /src=\{scenePresentation\.background\}/);
    assert.match(townPageSource, /className="scene-director"/);
    assert.match(townPageSource, /返回地图/);
    assert.match(townPageSource, /className=\{scene === "town" \? "map-hotspots" : "map-hotspots scene-dimmed"\}/);
    assert.match(townPageSource, /disabled=\{scene !== "town"\}/);
    assert.match(townPageSource, /function resolveBuildingScene/);
    assert.match(townPageSource, /function getScenePresentation/);
    assert.match(townStylesSource, /\.scene-kitchen \.stage-bg/);
    assert.match(townStylesSource, /\.scene-director/);
    assert.match(townStylesSource, /\.map-hotspots\.scene-dimmed/);
});

test("map hotspots expose playable affordances for buildings and residents", () => {
    assert.match(townPageSource, /aria-label=\{getBuildingHotspotLabel\(building\)\}/);
    assert.match(townPageSource, /aria-label=\{getCharacterHotspotLabel\(character\)\}/);
    assert.match(townPageSource, /function getBuildingHotspotLabel\(building: TownBuildingHotspotViewModel\)/);
    assert.match(townPageSource, /function getCharacterHotspotLabel\(character: TownCharacterHotspotViewModel\)/);
    assert.match(townPageSource, /className="hotspot-action-line"/);
    assert.match(townPageSource, /building\.upgradeable \? <em className="hotspot-upgrade">可升级<\/em> : null/);
    assert.match(townPageSource, /className="npc-hotspot-meta"/);
    assert.match(townPageSource, /className="npc-relationship-mini"/);
    assert.match(townPageSource, /style=\{\{ width: `\$\{Math\.min\(100, Math\.max\(0, character\.relationship\)\)\}%` \}\}/);
    assert.match(townStylesSource, /\.hotspot-action-line/);
    assert.match(townStylesSource, /\.hotspot-upgrade/);
    assert.match(townStylesSource, /\.npc-hotspot-meta/);
    assert.match(townStylesSource, /\.npc-relationship-mini/);
    assert.match(townStylesSource, /@keyframes hotspotRing/);
    assert.match(townStylesSource, /\.building-hotspot\.recommended::before,\s*\.npc-hotspot\.recommended::before\s*\{[\s\S]*animation: hotspotRing/);
    assert.match(townStylesSource, /\.building-hotspot::before/);
    assert.match(townStylesSource, /\.npc-hotspot::before/);
    assert.doesNotMatch(townStylesSource, /\.building-hotspot\.upgradeable::before/);
    assert.match(townReadmeSource, /场景热点 \| ready \| 建筑和居民热点展示推荐光环、可行动\/不可行动原因、升级徽章、关系条和记忆约定，并用完整 aria-label 保留移动端被压缩的行动说明/);
    assert.match(rootAgentsSource, /经营游戏地图或场景热点必须展示可行动性、推荐\/升级\/关系\/记忆状态，并用可访问名称保留移动端压缩隐藏的关键说明/);
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
    assert.match(townGamePanelsSource, /<Sheet open onOpenChange=/);
    assert.match(townGamePanelsSource, /<SheetContent side="right" showCloseButton=\{false\} className="game-drawer">/);
});

test("game modal drawer delegates dialog semantics to the system Sheet", () => {
    assert.match(townGamePanelsSource, /import \{ Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle \} from "@buildingai\/ui\/components\/ui\/sheet";/);
    assert.match(townGamePanelsSource, /<SheetTitle>\{title\}<\/SheetTitle>/);
    assert.match(townGamePanelsSource, /<SheetDescription className="sr-only">小镇面板<\/SheetDescription>/);
    assert.match(townGamePanelsSource, /<SheetClose asChild>/);
    assert.match(townGamePanelsSource, /aria-label=\{`收起\$\{title\}面板`\}/);
    assert.doesNotMatch(townGamePanelsSource, /aria-label="关闭"/);
    assert.doesNotMatch(townGamePanelsSource, /GAME_DRAWER_FOCUSABLE_SELECTOR/);
    assert.doesNotMatch(townGamePanelsSource, /slugifyGameModalTitle/);
    assert.doesNotMatch(townGamePanelsSource, /handleGameDrawerKeyDown/);
    assert.doesNotMatch(townGamePanelsSource, /keepGameDrawerFocusInside/);
    assert.match(townReadmeSource, /抽屉可控性 \| ready \| 游戏抽屉复用系统 Sheet/);
});

test("route error pages use main system buttons instead of native controls", () => {
    assert.ok(townRoutesSource.includes("@buildingai/ui/components/ui/button"));
    assert.ok(townRoutesSource.includes("<Button type=\"button\" variant=\"default\" onClick={() => navigate(\"/\")}>"));
    assert.match(townRoutesSource, />读取街区中<\/span>/);
    assert.match(townRoutesSource, />\s*重读小镇\s*<\/Button>/);
    assert.doesNotMatch(townRoutesSource, />加载中\.\.\.<\/span>/);
    assert.doesNotMatch(townRoutesSource, />重新加载<\/Button>/);
    assert.doesNotMatch(townRoutesSource, /<button\\b/);
    assert.match(townReadmeSource, /路由加载与错误 \| ready \| 懒加载、错误页和未开放路径使用读取街区、重读小镇、返回小镇等玩法语境/);
    assert.match(rootAgentsSource, /插件 lazy route、Suspense 和错误兜底属于首屏路径/);
});

test("web route bundle keeps console and icon work off the first screen", () => {
    const townMainSource = readFileSync(new URL("../src/web/main.tsx", import.meta.url), "utf8");
    assert.doesNotMatch(townMainSource, /from "@tanstack\/react-query"/);
    assert.doesNotMatch(townMainSource, /new QueryClient\(/);
    assert.doesNotMatch(townMainSource, /<QueryClientProvider/);
    assert.match(townMainSource, /<RootLayout>/);
    assert.match(townRoutesSource, /const ExtensionConsoleLayout = lazy\(\(\) => import\("@buildingai\/ui\/layouts\/extension\/console\/index"\)\)/);
    assert.doesNotMatch(townRoutesSource, /defineRouteOption/);
});

test("stage turn strip focuses the first playable view without adding another full panel", () => {
    assert.match(townGamePanelsSource, /export function StageTurnStrip/);
    assert.match(townPageSource, /<StageTurnStrip save=\{save\} goal=\{viewModel\.goal\} recommendedAction=\{viewModel\.recommendedAction\}/);
    assert.match(townGamePanelsSource, /className="stage-turn-strip"/);
    assert.match(townGamePanelsSource, /className="turn-strip-day"/);
    assert.match(townGamePanelsSource, /className="turn-strip-budget"/);
    assert.match(townGamePanelsSource, /className="turn-strip-recommendation"/);
    assert.match(townGamePanelsSource, /className="turn-strip-next-goal"/);
    assert.match(townGamePanelsSource, /getGoalActionLabel\(recommendedAction, targetLabel\)/);
    assert.match(townGamePanelsSource, /goal\.actionBudget\.remaining/);
    assert.match(townStylesSource, /\.stage-turn-strip/);
    assert.match(townStylesSource, /grid-template-columns: auto auto minmax\(140px, 1fr\) minmax\(140px, 1fr\)/);
    assert.match(townStylesSource, /width: clamp\(420px, calc\(100% - 560px\), 720px\)/);
    assert.match(townStylesSource, /max-width: calc\(100% - 560px\)/);
    assert.match(townStylesSource, /@media \(max-width: 1180px\)\s*\{[\s\S]*\.stage-turn-strip\s*\{[\s\S]*position: static;[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
    assert.match(townStylesSource, /pointer-events: none/);
    assert.match(townStylesSource, /\.stage-turn-strip button/);
    assert.match(townStylesSource, /pointer-events: auto/);
    assert.match(townReadmeSource, /回合状态条 \| ready \| 首屏使用低遮挡状态条集中展示 Day、今日行动、推荐动作和下一目标/);
    assert.match(rootAgentsSource, /经营游戏首屏应优先用低遮挡回合状态条集中展示日期、行动预算、推荐动作和下一目标/);
});

test("town action fallbacks stay in player-action language", () => {
    assert.match(townGameRulesSource, /return labels\[action\] \?\? \(targetLabel \? `照看\$\{targetLabel\}` : "照看小镇"\);/);
    assert.doesNotMatch(townGameRulesSource, /return labels\[action\] \?\? "继续行动"/);
    assert.match(townGamePanelsSource, /recommendedAction \? getGoalActionLabel\(recommendedAction, targetLabel\) : "打开委托册"/);
    assert.match(townGamePanelsSource, /<Button type="button" variant="ghost" onClick=\{onOpenTasks\}>打开委托册<\/Button>/);
    assert.match(townGamePanelsSource, /state\.preview\.join\(" · "\) \|\| "可以出发"/);
    assert.doesNotMatch(townGamePanelsSource, /查看今日任务/);
    assert.doesNotMatch(townGamePanelsSource, />查看任务<\/Button>/);
    assert.doesNotMatch(townGamePanelsSource, /"可执行"/);
    assert.match(townReadmeSource, /回合状态条 \| ready \| 首屏使用低遮挡状态条集中展示 Day、今日行动、推荐动作和下一目标；无推荐动作时引导玩家打开委托册/);
    assert.match(townReadmeSource, /首屏命令牌 \| ready \| 底部行动栏以游戏命令牌展示推荐、任务关联、收益预览、预算提示和 blocked 态；空预览使用可以出发/);
    assert.match(townReadmeSource, /首屏行动 \| 首屏行动栏必须像游戏命令牌/);
    assert.match(rootAgentsSource, /经营游戏首屏行动、推荐和预览的兜底文案也必须是玩家动作或玩法对象/);
});

test("today plan can execute a mapped recommended action", () => {
    assert.match(townGamePanelsSource, /onRunRecommendedAction\?: \(action: string\) => void/);
    assert.match(townGamePanelsSource, /function mapStrategyAction\(action: string\)/);
    assert.match(townGamePanelsSource, /function mapPlanAction\(actionLabel: string\)/);
    assert.match(townGamePanelsSource, /const recommendedActionState = recommendedAction \? getActionState\(save, recommendedAction\) : null;/);
    assert.match(townGamePanelsSource, /const recommendedActionLabel = recommendedAction \? getGoalActionLabel\(recommendedAction, strategy\?\.target \?\? plan\.targetLabel \?\? plan\.actionLabel\) : "";/);
    assert.match(townGamePanelsSource, /className=\{recommendedActionState\?\.canRun \? "strategy-action-card ready" : "strategy-action-card blocked"\}/);
    assert.match(townGamePanelsSource, /aria-label=\{recommendedActionLabel \? `镇务参谋建议：\$\{recommendedActionLabel\}` : "镇务参谋建议"\}/);
    assert.match(townGamePanelsSource, /\{recommendedActionState\?\.canRun \? recommendedActionLabel : "暂不可行动"\}/);
    assert.doesNotMatch(townGamePanelsSource, />执行推荐行动</);
    assert.match(townReadmeSource, /今日计划推荐 CTA 显示规则映射后的具体玩家动作，不写成“执行推荐行动”/);
    assert.match(rootAgentsSource, /镇务参谋、今日计划或推荐行动入口也必须显示规则映射后的实际玩家动作/);
    assert.match(townPageSource, /<AdvicePanel save=\{save\} latestEvent=\{latestEvent\} onRunRecommendedAction=\{\(action\) => runAction\(action\)\}/);
});
