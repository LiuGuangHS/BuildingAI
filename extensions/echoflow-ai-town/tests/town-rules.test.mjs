import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const aiServiceSource = readFileSync(new URL("../src/api/modules/town/services/town-ai.service.ts", import.meta.url), "utf8");
const progressRulesSource = readFileSync(new URL("../src/api/modules/town/services/town-progress-rules.service.ts", import.meta.url), "utf8");
const relationshipRulesSource = readFileSync(new URL("../src/api/modules/town/services/town-relationship-rules.service.ts", import.meta.url), "utf8");
const worldRulesSource = readFileSync(new URL("../src/api/modules/town/services/town-world-rules.service.ts", import.meta.url), "utf8");
const townServiceSource = readFileSync(new URL("../src/api/modules/town/services/town.service.ts", import.meta.url), "utf8");

test("world rules keep deterministic building costs and unlock rules", () => {
    assert.match(worldRulesSource, /getBuildingUpgradeCost\(level: number\)/);
    assert.match(worldRulesSource, /return 60 \+ level \* 35/);
    assert.match(worldRulesSource, /area: "夜市街角", unlocked: worldState\.reputation >= 30/);
    assert.match(worldRulesSource, /area: "二层露台", unlocked: this\.getBuildingLevel\(worldState, "restaurant"\) >= 3/);
    assert.match(worldRulesSource, /area: "庆典会场"/);
});

test("world rules advance countdown festivals and record completions", () => {
    assert.match(worldRulesSource, /advanceFestival\(worldState: TownWorldState, save: TownSave, action: string\)/);
    assert.match(worldRulesSource, /status: "announced"/);
    assert.match(worldRulesSource, /daysLeft: 3/);
    assert.match(worldRulesSource, /completedFestivals/);
    assert.match(townServiceSource, /活动完成：\$\{event\.title\}/);
    assert.match(townServiceSource, /save\.coins = Math\.max\(0, save\.coins \+ \(reward\.coins \?\? 0\)\)/);
});

test("progress rules preserve task, weekly, quest, and achievement loops", () => {
    assert.match(progressRulesSource, /createDailyTasks\(day: number\)/);
    assert.match(progressRulesSource, /type: "earnCoins"/);
    assert.match(progressRulesSource, /type: "gainReputation"/);
    assert.match(progressRulesSource, /createWeeklyGoal\(day = 1\)/);
    assert.match(progressRulesSource, /createMainQuest\(chapter: number\)/);
    assert.match(progressRulesSource, /applyProgress\(/);
    assert.match(progressRulesSource, /第一桶金/);
    assert.match(progressRulesSource, /庆典小镇/);
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
    assert.match(townServiceSource, /result\.strategy = advice\.strategy/);
});
