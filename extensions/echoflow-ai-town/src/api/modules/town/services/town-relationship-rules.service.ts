import { Injectable } from "@nestjs/common";

import type { TownCharacter, TownEvent, TownSave, TownEventResult } from "../../../db/entities";
import { TOWN_ACTION_LABELS } from "../catalog";
import type { TownActionDto } from "../dto";

export type RelationshipUpdate = {
    character: TownCharacter;
    oldLevel: string;
    newLevel: string;
    delta: number;
};

export type RelationshipBonus = {
    key: string;
    label: string;
    desc: string;
    coins?: number;
    stamina?: number;
    reputation?: number;
    discount?: number;
};

@Injectable()
export class TownRelationshipRulesService {
    pickTarget(characters: TownCharacter[], save: TownSave, action: string) {
        if (!["visit", "chat", "explore", "decorate"].includes(action)) return null;
        if (!characters.length) return null;
        if (save.worldState?.weather === "小雨") {
            return characters.find((character) => character.role.includes("花店")) ?? characters[0];
        }
        if (action === "explore") {
            return characters.find((character) => character.role.includes("旅人")) ?? characters[0];
        }
        if (action === "decorate") {
            return characters.find((character) => character.role.includes("花店")) ?? characters[0];
        }
        return characters[0];
    }

    getRelationshipDelta(action: string) {
        if (action === "visit") return 3;
        if (action === "chat") return 3;
        if (action === "decorate") return 2;
        if (action === "explore") return 1;
        return 0;
    }

    getRelationshipLevel(value: number) {
        if (value >= 80) return "羁绊";
        if (value >= 60) return "信赖";
        if (value >= 40) return "朋友";
        if (value >= 20) return "熟悉";
        return "陌生";
    }

    getRelationshipBonuses(characters: TownCharacter[], action: string): RelationshipBonus[] {
        return characters.flatMap<RelationshipBonus>((character) => {
            const tier = this.getRelationshipTier(character.relationship);
            if (!tier) return [];
            if (action === "operate" && character.name === "小满") {
                const coins = tier === 3 ? 14 : tier === 2 ? 9 : 5;
                return [{ key: "xiaoman-operate", label: "小满帮厨", desc: `小满帮你提前备菜，经营额外 +${coins} 金币。`, coins }];
            }
            if (action === "decorate" && character.name === "花音") {
                const reputation = tier === 3 ? 5 : tier === 2 ? 3 : 2;
                return [{ key: "huayin-decorate", label: "花音花艺", desc: `花音调整街角花束，布置额外 +${reputation} 声望。`, reputation }];
            }
            if (action === "explore" && character.name === "旅人洛") {
                const stamina = tier === 3 ? 5 : tier === 2 ? 3 : 2;
                return [{ key: "traveler-explore", label: "旅人向导", desc: `旅人洛指出捷径，探索返还 ${stamina} 体力。`, stamina }];
            }
            return [];
        });
    }

    getUpgradeDiscount(characters: TownCharacter[]) {
        const aze = characters.find((character) => character.name === "阿泽");
        if (!aze) return 0;
        const tier = this.getRelationshipTier(aze.relationship);
        if (tier === 3) return 20;
        if (tier === 2) return 14;
        if (tier === 1) return 8;
        return 0;
    }

    applyCharacterRelationship(character: TownCharacter, delta: number, action: TownActionDto["action"]): RelationshipUpdate {
        const oldLevel = this.getRelationshipLevel(character.relationship);
        character.relationship = Math.min(100, Math.max(0, character.relationship + delta));
        const newLevel = this.getRelationshipLevel(character.relationship);
        character.status = this.getNpcStatusAfterAction(character, action);
        character.memory = {
            ...(character.memory ?? {}),
            relationshipLevel: newLevel,
            summary: this.createNpcMemorySummary(character, action, newLevel),
            lastEventTitle: this.createNpcStoryTitle(character),
            mood: newLevel === oldLevel ? "更亲近" : "关系升温",
        };
        return { character, oldLevel, newLevel, delta };
    }

    createRelationshipLevelEvent(eventFactory: (params: Partial<TownEvent>) => TownEvent, userId: string, saveId: string, character: TownCharacter, oldLevel: string, newLevel: string, delta: number, choices: TownEvent["choices"]): TownEvent {
        return eventFactory({
            userId,
            saveId,
            type: "relationship",
            title: `关系升温：${character.name}`,
            content: `你和${character.name}的关系从“${oldLevel}”提升到“${newLevel}”。${this.createNpcBondLine(character, newLevel)}`,
            choices,
            result: { relationship: { [character.id]: delta } } satisfies TownEventResult,
        });
    }

    createNpcStoryEvent(eventFactory: (params: Partial<TownEvent>) => TownEvent, userId: string, saveId: string, character: TownCharacter, action: TownActionDto["action"], delta: number, choices: TownEvent["choices"]): TownEvent {
        return eventFactory({
            userId,
            saveId,
            type: "npc_story",
            title: this.createNpcStoryTitle(character),
            content: this.createNpcStoryContent(character),
            choices,
            result: { relationship: { [character.id]: delta } } satisfies TownEventResult,
        });
    }

    private createNpcStoryTitle(character: TownCharacter) {
        if (character.role.includes("花店")) return "花音的街角花束";
        if (character.role.includes("旅人")) return "旅人洛的远方传闻";
        if (character.role.includes("老板")) return "阿泽的账本计划";
        return "小满的新菜单灵感";
    }

    private getRelationshipTier(value: number) {
        if (value >= 80) return 3;
        if (value >= 60) return 2;
        if (value >= 40) return 1;
        return 0;
    }

    private createNpcStoryContent(character: TownCharacter) {
        if (character.role.includes("花店")) return `${character.name}把一束刚包好的小花递给你，提议用温柔的装饰吸引更多居民停留。`;
        if (character.role.includes("旅人")) return `${character.name}在广场边停下脚步，说旧喷泉附近也许还藏着下一段街区传闻。`;
        if (character.role.includes("老板")) return `${character.name}摊开账本，帮你把今天的现金流和下一次升级计划重新排了一遍。`;
        return `${character.name}记下居民喜欢的味道，兴奋地说下一次营业可以试试新的套餐。`;
    }

    private createNpcMemorySummary(character: TownCharacter, action: TownActionDto["action"], level: string) {
        return `${character.name}记得你今天通过${this.formatActionName(action)}靠近了小镇居民，现在把你当作“${level}”的伙伴。`;
    }

    private createNpcBondLine(character: TownCharacter, level: string) {
        if (level === "羁绊") return `${character.name}已经把重要的小镇秘密托付给你。`;
        if (level === "信赖") return `${character.name}开始主动分享更深的小镇线索。`;
        if (level === "朋友") return `${character.name}愿意和你一起筹备新的街角活动。`;
        return `${character.name}对你的经营方式更熟悉了。`;
    }

    private getNpcStatusAfterAction(character: TownCharacter, action: TownActionDto["action"]) {
        if (action === "explore") return "分享传闻";
        if (action === "decorate") return "筹备布置";
        if (action === "visit") return "刚被拜访";
        return character.status;
    }

    private formatActionName(action: TownActionDto["action"]) {
        return TOWN_ACTION_LABELS[action] ?? action;
    }
}
