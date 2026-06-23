import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@buildingai/ui/components/ui/alert-dialog";
import { Button } from "@buildingai/ui/components/ui/button";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

import { ASSETS, getNpcAsset } from "../assets";
import { createCompanionMessage, formatEventType, formatFestivalAction, formatFestivalStatus, formatRequirement, getActionForTaskType, getBuildingActionCopy, getChoicePreview, getChoiceTone, getGoalActionLabel, getGoalActionTarget, getNextUnlockGoal, getRecommendedAction, getRecommendedTarget, getRelationshipBenefit, getRelationshipLevel, getResultSummary, getStrategyPlan, getUpgradeCost, groupEvents, isAiEventType, type TownGoalActionTarget } from "../lib/game-rules";
import type { TownBuilding, TownCharacter, TownEvent, TownSave, TownSaveListResult } from "../services/types";
import type { TownCommandViewModel, TownGoalViewModel } from "../lib/town-view-model";
import { getActionState } from "../lib/town-view-model";
import { AssetImage } from "./asset-image";

type SaveSummary = TownSaveListResult["list"][number];
export type GameModal = "building" | "npc" | "event" | "events" | "advice" | "settlement" | "tasks" | "ai-confirm" | null;
type AiUsageConfirmKind = "advice" | "chat";
const GAME_DRAWER_FOCUSABLE_SELECTOR = 'a[href], button:not(:disabled), textarea:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])';

export function SavePicker({ saves, pendingId, onDelete, onLoad }: { saves: SaveSummary[]; pendingId?: string; onDelete: (saveId: string) => void; onLoad: (saveId: string) => void }) {
    return (
        <div className="save-picker game-save-picker">
            <div className="save-picker-header">
                <h3>回到小镇</h3>
                <span>{saves.length} 个存档</span>
            </div>
            <div className="save-list">
                {saves.map((save) => (
                    <article key={save.id}>
                        <div>
                            <strong>{save.name}</strong>
                            <small>Day {save.day} · Lv.{save.level} · 金币 {save.coins} · 体力 {save.stamina}</small>
                        </div>
                        <div className="save-actions">
                            <Button type="button" variant="outline" className="ghost-button" disabled={pendingId === save.id} aria-label={`回到存档：${save.name}`} onClick={() => onLoad(save.id)}>
                                {pendingId === save.id ? "读取街区" : "回到存档"}
                            </Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button type="button" variant="destructive" className="danger-button">移除存档</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>移入旧档箱</AlertDialogTitle>
                                        <AlertDialogDescription>确认把「{save.name}」移入旧档箱吗？这座小镇会从当前列表离开，相关居民和事件也会一同归档。</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>留在小镇</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => onDelete(save.id)}>移入旧档箱</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </article>
                ))}
            </div>
        </div>
    );
}

export function BuildingPanel({ building, pending, save, onAction }: { building: TownBuilding; pending: boolean; save: TownSave; onAction: (action: string, params?: { buildingId?: string }) => void }) {
    const cost = getUpgradeCost(building.level);
    const isMaxLevel = building.level >= (building.maxLevel ?? 5);
    const buildingAction = building.id === "restaurant" ? "operate" : building.id === "florist" ? "visit" : "explore";
    const secondaryAction = building.id === "florist" ? "decorate" : building.id === "square" ? "decorate" : null;
    const actionState = getActionState(save, buildingAction);
    const secondaryState = secondaryAction ? getActionState(save, secondaryAction) : null;
    const upgradeState = getActionState(save, "upgrade", building.id);
    const copy = getBuildingActionCopy(building.id);
    return (
        <div className="game-panel-grid">
            <AssetImage src={building.id === "restaurant" ? ASSETS.backgrounds.kitchen : ASSETS.screenshots.town} alt={building.name} className="panel-art" />
            <div className="panel-copy">
                <p className="game-eyebrow">建筑 Lv.{building.level}</p>
                <h3>{building.name}</h3>
                <p>{building.effect ?? "提升小镇经营收益"}</p>
                <div className="panel-stat-row">
                    <span>状态：{building.status}</span>
                    <span>升级费用：{isMaxLevel ? "满级" : `${cost} 金币`}</span>
                </div>
                <div className="panel-actions">
                    <Button type="button" variant="default" className="game-primary" disabled={pending || !actionState.canRun} title={actionState.disabledReason} onClick={() => onAction(buildingAction)}>
                        {actionState.canRun ? copy.primary : actionState.disabledReason}
                    </Button>
                    {secondaryAction && secondaryState ? (
                        <Button type="button" variant="outline" className="game-secondary" disabled={pending || !secondaryState.canRun} title={secondaryState.disabledReason} onClick={() => onAction(secondaryAction)}>
                            {secondaryState.canRun ? copy.secondary : secondaryState.disabledReason}
                        </Button>
                    ) : null}
                    <Button type="button" variant="outline" className="game-secondary" disabled={pending || isMaxLevel || !upgradeState.canRun} title={upgradeState.disabledReason} onClick={() => onAction("upgrade", { buildingId: building.id })}>
                        {isMaxLevel ? "已满级" : upgradeState.canRun ? `${copy.upgrade} ${cost}` : upgradeState.disabledReason}
                    </Button>
                </div>
                <ActionPreviewList items={[
                    { title: copy.primary, state: actionState },
                    secondaryAction && secondaryState ? { title: copy.secondary, state: secondaryState } : null,
                    { title: copy.upgrade, state: upgradeState },
                ]} />
                <p className="building-action-tip">{copy.tip}</p>
            </div>
        </div>
    );
}

function createNpcConversationPrompts(character: TownCharacter | null) {
    if (!character) {
        return [];
    }
    const prompts = [
        ...(character.memory?.promises ?? []).slice(-2).map((item) => ({
            label: "回应约定",
            message: `还记得我们约好的「${item}」吗？今天可以怎么推进？`,
        })),
        ...(character.memory?.preferences ?? []).slice(-2).map((item) => ({
            label: "聊偏好",
            message: `我想按你喜欢的「${item}」来安排小镇，给我一点建议吧。`,
        })),
        ...(character.memory?.keyMoments ?? []).slice(-1).map((item) => ({
            label: "回顾时刻",
            message: `上次的「${item.title}」让我很在意，你现在怎么看？`,
        })),
    ];

    if (!prompts.length) {
        prompts.push(
            { label: "问近况", message: "今天小镇有什么需要我马上处理的事吗？" },
            { label: "关系行动", message: "我想和你一起做一件能加深关系的小事。" },
        );
    }

    return prompts.slice(0, 4);
}

export function NpcPanel({ activeCharacter, chatText, lastReply, pending, save, setActiveCharacter, setChatText, onChat }: { activeCharacter: TownCharacter | null; chatText: string; lastReply: string; pending: boolean; save: TownSave; setActiveCharacter: (character: TownCharacter) => void; setChatText: (value: string) => void; onChat: () => void }) {
    const conversationPrompts = createNpcConversationPrompts(activeCharacter);
    const dialoguePlaceholder = activeCharacter ? `给${activeCharacter.name}留一句今天的小镇话题` : "先选择一位居民";
    return (
        <div className="npc-dialogue-layout">
            <div className="npc-roster">
                {save.characters.map((character) => (
                    <Button type="button" variant="ghost" className={activeCharacter?.id === character.id ? "active" : ""} key={character.id} onClick={() => setActiveCharacter(character)}>
                        <AssetImage src={getNpcAsset(character.role)} alt={character.name} className="avatar-image" fallback={<span className="avatar-image npc-fallback-avatar" aria-hidden="true">{character.name.slice(0, 1)}</span>} />
                        <span>
                            <strong>{character.name}</strong>
                            <small>{character.role} · {getRelationshipLevel(character.relationship)} · 关系 {character.relationship}</small>
                            <RelationshipBar value={character.relationship} compact />
                        </span>
                    </Button>
                ))}
            </div>
            <div className="chat-box game-chat-box">
                <AssetImage src={ASSETS.screenshots.npc} alt="居民对话场景" className="dialogue-bg" />
                {activeCharacter ? (
                    <div className="npc-profile-card">
                        <div className="npc-profile-header">
                            <AssetImage src={getNpcAsset(activeCharacter.role)} alt={activeCharacter.name} className="npc-profile-avatar" fallback={<span className="npc-profile-avatar npc-fallback-avatar" aria-hidden="true">{activeCharacter.name.slice(0, 1)}</span>} />
                            <div>
                                <strong>{activeCharacter.name} · {activeCharacter.memory?.relationshipLevel ?? getRelationshipLevel(activeCharacter.relationship)}</strong>
                                <span>{activeCharacter.role} · {activeCharacter.status}</span>
                            </div>
                        </div>
                        <RelationshipBar value={activeCharacter.relationship} />
                        <div className="npc-memory-card">
                            <strong>长期记忆</strong>
                            <p>{activeCharacter.memory?.summary ?? "还没有形成新的聊天记忆。"}</p>
                        </div>
                        <div className="npc-memory-tags">
                            {activeCharacter.memory?.mood ? <span>心情：{activeCharacter.memory.mood}</span> : null}
                            {(activeCharacter.memory?.preferences ?? []).slice(-3).map((item) => <span key={item}>偏好：{item}</span>)}
                            {(activeCharacter.memory?.promises ?? []).slice(-2).map((item) => <span key={item}>约定：{item}</span>)}
                        </div>
                        {activeCharacter.memory?.keyMoments?.length ? (
                            <div className="npc-key-moments">
                                <strong>关键时刻</strong>
                                {activeCharacter.memory.keyMoments.slice(-2).map((moment) => (
                                    <article key={`${moment.day}-${moment.title}`}>
                                        <span>{moment.title}</span>
                                        <p>{moment.summary}</p>
                                    </article>
                                ))}
                            </div>
                        ) : null}
                        <div className="npc-benefit-card">
                            <strong>关系收益</strong>
                            <p>{getRelationshipBenefit(activeCharacter)}</p>
                        </div>
                        <div className={activeCharacter.memory?.promises?.length || activeCharacter.memory?.preferences?.length || activeCharacter.memory?.keyMoments?.length ? "npc-dialogue-prompts memory-driven" : "npc-dialogue-prompts"}>
                            <strong>可聊话题</strong>
                            <div>
                                {conversationPrompts.map((prompt) => (
                                    <Button type="button" variant="ghost" className="dialogue-prompt-chip" key={`${prompt.label}-${prompt.message}`} onClick={() => setChatText(prompt.message)}>
                                        <span>{prompt.label}</span>
                                        <small>{prompt.message}</small>
                                    </Button>
                                ))}
                            </div>
                        </div>
                        <div className="npc-memory-list">
                            {(activeCharacter.memory?.recentMessages ?? []).slice(-3).map((message, index) => (
                                <article key={`${message.at}-${index}`}>
                                    <span>你：{message.user}</span>
                                    <p>{activeCharacter.name}：{message.reply}</p>
                                </article>
                            ))}
                        </div>
                    </div>
                ) : null}
                <div className="npc-conversation-composer">
                    <p className="ai-usage-note">和居民聊前会提示镇务额度，居民回应会参考当前关系、记忆和今日行动。</p>
                    <Textarea value={chatText} placeholder={dialoguePlaceholder} aria-label={activeCharacter ? `给${activeCharacter.name}写一句话` : "选择居民后写一句话"} onChange={(event) => setChatText(event.target.value)} />
                    <Button type="button" aria-label={activeCharacter ? `和${activeCharacter.name}聊天` : "先选择居民"} disabled={!activeCharacter || pending} onClick={onChat}>{activeCharacter ? pending ? `等${activeCharacter.name}回应` : `和${activeCharacter.name}聊天` : "先选择居民"}</Button>
                </div>
                {lastReply ? (
                    <div className="npc-reply-bubble">
                        <span>{activeCharacter?.name ?? "居民"}</span>
                        <p>{lastReply}</p>
                    </div>
                ) : (
                    <div className="npc-empty-bubble">
                        <span>对话提示</span>
                        <p>选择一个居民，点选记忆话题或输入想聊的事，居民会按角色身份回应。</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export function NpcHotspotAvatar({ character }: { character: TownCharacter }) {
    return <AssetImage src={getNpcAsset(character.role)} alt={character.name} className="npc-hotspot-avatar" fallback={<span className="npc-hotspot-avatar npc-fallback-avatar" aria-hidden="true">{character.name.slice(0, 1)}</span>} />;
}

export function EventPanel({ events, pending, save, onChoice }: { events: TownEvent[]; pending: boolean; save: TownSave; onChoice: (choiceId: string) => void }) {
    const groupedEvents = groupEvents(events);
    return (
        <div className="event-list game-event-list event-storybook">
            {groupedEvents.map((group) => (
                <section className="event-history-group" key={group.title}>
                    <h3 className="event-history-title">
                        <span>小镇故事册</span>
                        <strong>{group.title}</strong>
                    </h3>
                    <div className="event-history-timeline">
                        {group.events.map((event) => (
                            <article className={`event-timeline-entry event-${event.type}`} key={event.id}>
                                <span className="event-timeline-node" aria-hidden="true">{formatEventType(event.type).slice(0, 1)}</span>
                                <div className="event-timeline-card">
                                    <EventImage eventType={event.type} />
                                    <div className="event-timeline-meta">
                                        <span>{formatEventType(event.type)}</span>
                                        <small>{event.result ? "行动写入小镇" : event.choices?.length ? "等待玩家选择" : "街区记录"}</small>
                                    </div>
                                    <h4>{event.title}</h4>
                                    <p>{event.content}</p>
                                    {event.result ? <div className="event-result-inline"><ResultBar event={event} /></div> : null}
                                    {event.choices?.length ? (
                                        <div className="event-choices compact-choices">
                                            {event.choices.map((choice) => (
                                                <ChoiceButton choice={choice} disabled={pending} key={choice.id} save={save} onChoice={onChoice} />
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            </article>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}

export function EventCard({ event, pending, save, onBack, onChoice }: { event: TownEvent; pending: boolean; save: TownSave; onBack: () => void; onChoice: (choiceId: string) => void }) {
    const choices = event.choices ?? [];
    const hasChoices = choices.length > 0;
    return (
        <article className="event-card-main">
            <EventImage eventType={event.type} />
            <div className="event-card-header-row">
                <div className="event-card-badge">{isAiEventType(event.type) ? "参谋事件" : formatEventType(event.type)}</div>
                <span className="event-phase-badge">{event.result ? "行动结果" : hasChoices ? "选择分支" : "小镇记录"}</span>
            </div>
            <h3>{event.title}</h3>
            <p>{event.content}</p>
            {event.result ? <EventResultCard event={event} /> : null}
            {hasChoices ? (
                <div className="event-choices primary-choices">
                    {choices.map((choice) => (
                        <ChoiceButton choice={choice} disabled={pending} key={choice.id} save={save} onChoice={onChoice} />
                    ))}
                </div>
            ) : null}
            <div className="event-card-footer">
                <Button type="button" variant="outline" className="game-secondary" onClick={onBack}>返回地图</Button>
                {event.result ? <small>{getResultSummary(event)}</small> : <small>选择会消耗资源并推进小镇状态。</small>}
            </div>
        </article>
    );
}

function ChoiceButton({ choice, disabled, save, onChoice }: { choice: NonNullable<TownEvent["choices"]>[number]; disabled: boolean; save: TownSave; onChoice: (choiceId: string) => void }) {
    const actionState = getActionState(save, choice.id);
    const choiceClassName = `event-choice-card choice-${getChoiceTone(choice.id)}${!actionState.canRun ? " blocked" : ""}`;
    const previewItems = actionState.preview.length ? actionState.preview : [actionState.canRun ? "可以出发" : actionState.disabledReason];
    return (
        <Button type="button" variant="ghost" className={choiceClassName} disabled={disabled || !actionState.canRun} title={actionState.disabledReason} aria-label={getChoiceAriaLabel(choice, actionState)} onClick={() => onChoice(choice.id)}>
            <span className="choice-kicker">分支选择</span>
            <strong>{choice.label}</strong>
            <small>{actionState.canRun ? choice.hint : actionState.disabledReason}</small>
            <span className="choice-preview">
                {previewItems.map((item) => <span className="choice-preview-chip" key={item}>{item}</span>)}
            </span>
        </Button>
    );
}

function getChoiceAriaLabel(choice: NonNullable<TownEvent["choices"]>[number], actionState: ReturnType<typeof getActionState>) {
    const status = actionState.canRun ? "可以出发" : `暂不能出发，${actionState.disabledReason}`;
    const preview = actionState.preview.length ? `，预计变化：${actionState.preview.join("，")}` : "";
    const hint = actionState.canRun ? choice.hint : actionState.disabledReason;
    return `事件分支：${choice.label}，${status}，${hint}${preview}`;
}

function EventResultCard({ event }: { event: TownEvent }) {
    const audit = event.result?.audit;
    return (
        <div className="event-result-card">
            <div>
                <strong>行动结算</strong>
                <small>{getResultSummary(event)}</small>
            </div>
            <ResultBar event={event} />
            {audit ? (
                <div className="result-audit-panel">
                    <div className="result-audit-meta">
                        <span>{audit.action?.label ?? formatActionRef(event.type)}</span>
                        <span>{formatAuditSource(audit.source)}</span>
                        {audit.action?.choiceLabel ? <span>选择：{audit.action.choiceLabel}</span> : null}
                        {audit.action?.buildingName ? <span>建筑：{audit.action.buildingName}</span> : null}
                        {audit.action?.relationshipTargetName ? <span>居民：{audit.action.relationshipTargetName}</span> : null}
                        {audit.budget ? <span>行动 {audit.budget.usedAfter}/{audit.budget.maxPerDay}</span> : null}
                        {audit.model?.fallbackUsed ? <span>规则补位</span> : audit.model?.assisted ? <span>参谋参与</span> : null}
                        {event.result?.billingStatus ? <span className={event.result.refundError ? "billing-chip warning" : "billing-chip"}>{formatBillingFact(event)}</span> : null}
                    </div>
                    <div className="result-audit-grid">
                        <AuditDelta label="金币" after={audit.after.coins} before={audit.before.coins} />
                        <AuditDelta label="体力" after={audit.after.stamina} before={audit.before.stamina} />
                        <AuditDelta label="声望" after={audit.after.reputation} before={audit.before.reputation} />
                        <AuditDelta label="等级" after={audit.after.level} before={audit.before.level} />
                    </div>
                    {audit.resourceBreakdown?.length ? (
                        <div className="result-breakdown-list">
                            {audit.resourceBreakdown.slice(0, 5).map((item, index) => (
                                <span className={item.value < 0 ? "negative" : item.value > 0 ? "positive" : ""} key={`${item.label}-${index}`}>
                                    {item.label} {item.value ? `${item.value > 0 ? "+" : ""}${item.value}` : ""}<small>{item.detail}</small>
                                </span>
                            ))}
                        </div>
                    ) : null}
                    <div className="result-rule-list">
                        {audit.ruleRefs.map((rule) => <span key={rule}>{formatRuleRef(rule)}</span>)}
                    </div>
                    {audit.notes.length ? <p>{audit.notes.join(" · ")}</p> : null}
                </div>
            ) : null}
        </div>
    );
}

function AuditDelta({ after, before, label }: { after: number; before: number; label: string }) {
    return <span>{label} <strong>{before} {"->"} {after}</strong></span>;
}

function formatBillingFact(event: TownEvent) {
    const amount = event.result?.billingAmount ? ` ${event.result.billingAmount}` : "";
    const label = event.result?.billingLabel ? `${event.result.billingLabel}` : "镇务额度";
    if (event.result?.refundError) return `${label}退款异常`;
    if (event.result?.billingStatus === "refunded") return `${label}已按账务事实退款${amount}`;
    return `${label}已扣费${amount}`;
}

export function AiCompanion({ save, goal, pending, onOpenAdvice }: { save: TownSave; goal: TownGoalViewModel; pending: boolean; onOpenAdvice: () => void }) {
    const recommendedAction = getRecommendedAction(save, getRecommendedTarget(save));
    const recommendedActionLabel = recommendedAction ? getGoalActionLabel(recommendedAction, goal.primary.title) : "查看今日计划";
    const recommendedState = recommendedAction ? getActionState(save, recommendedAction) : null;
    const companionPreview = recommendedState?.preview.length ? recommendedState.preview.join(" · ") : goal.primary.desc;
    return (
        <Button type="button" variant="ghost" className={pending ? "ai-companion scheduling" : "ai-companion"} aria-label={`镇务参谋：${recommendedActionLabel}，${companionPreview}`} onClick={onOpenAdvice}>
            <AssetImage src={ASSETS.npcs.cat} alt="小镇参谋" className="ai-companion-avatar" fallback={<span className="ai-companion-avatar npc-fallback-avatar" aria-hidden="true">参谋</span>} />
            <span>
                <strong>{pending ? "镇务排班中" : "镇务参谋"}</strong>
                <small>{createCompanionMessage(save)}</small>
            </span>
            <span className="companion-recommendation">
                <span>下一步</span>
                <strong>{recommendedActionLabel}</strong>
                <small>{recommendedState?.canRun ? companionPreview : recommendedState?.disabledReason ?? goal.primary.desc}</small>
            </span>
            {goal.memoryPromiseCount ? <em className="companion-memory-chip">待回应约定 {goal.memoryPromiseCount}</em> : null}
        </Button>
    );
}

export function AiUsageConfirmCard({ kind = "advice", characterName, onAccept, onCancel }: { kind?: AiUsageConfirmKind; characterName?: string; onAccept: () => void; onCancel: () => void }) {
    const residentLabel = characterName ?? "居民";
    const copy = kind === "chat"
        ? {
            title: `和${residentLabel}继续聊`,
            desc: `和${residentLabel}聊前会提示镇务额度，居民回应会参考当前关系、记忆和今日行动。`,
            actionLabel: `和${residentLabel}聊`,
            cancelLabel: "先留在小镇",
        }
        : {
            title: "安排今日计划",
            desc: "安排计划前会提示镇务额度，参谋会参考当前资源、任务和记忆约定安排下一步。",
            actionLabel: "安排计划",
            cancelLabel: "先留在小镇",
        };
    return (
        <div className="ai-confirm-card">
            <AssetImage src={ASSETS.npcs.cat} alt="小镇参谋" className="ai-confirm-avatar" fallback={<span className="ai-confirm-avatar npc-fallback-avatar" aria-hidden="true">参谋</span>} />
            <div>
                <p className="game-eyebrow">镇务参谋提示</p>
                <h3>{copy.title}</h3>
                <p>{copy.desc}</p>
                <div className="panel-actions">
                    <Button type="button" variant="default" className="game-primary" aria-label={copy.actionLabel} onClick={onAccept}>{copy.actionLabel}</Button>
                    <Button type="button" variant="outline" className="game-secondary" aria-label={copy.cancelLabel} onClick={onCancel}>{copy.cancelLabel}</Button>
                </div>
            </div>
        </div>
    );
}

export function AdvicePanel({ save, latestEvent, onRunRecommendedAction }: { save: TownSave; latestEvent: TownEvent | null; onRunRecommendedAction?: (action: string) => void }) {
    const plan = getStrategyPlan(save);
    const strategy = latestEvent?.type === "advice" ? latestEvent.result?.strategy : null;
    const advice = strategy?.summary ?? (latestEvent?.type === "advice" ? latestEvent.content : save.suggestion);
    const recommendedAction = strategy?.action ? mapStrategyAction(strategy.action) : mapPlanAction(plan.actionLabel);
    const recommendedActionState = recommendedAction ? getActionState(save, recommendedAction) : null;
    const recommendedActionLabel = recommendedAction ? getGoalActionLabel(recommendedAction, strategy?.target ?? plan.targetLabel ?? plan.actionLabel) : "";
    const canRunRecommendedAction = Boolean(onRunRecommendedAction && recommendedActionState?.canRun);
    const preview = recommendedActionState?.preview.length ? recommendedActionState.preview.join(" · ") : "查看当前目标后再行动";
    return (
        <div className="strategy-panel">
            <section className="strategy-hero">
                <AssetImage src={ASSETS.npcs.cat} alt="小镇参谋" className="strategy-avatar" fallback={<span className="strategy-avatar npc-fallback-avatar" aria-hidden="true">参谋</span>} />
                <div>
                    <p className="game-eyebrow">镇务参谋</p>
                    <h3>今日计划</h3>
                    <p>{advice}</p>
                    <p className="ai-usage-note">镇务参谋会按当前资源、任务和记忆约定安排下一步。</p>
                </div>
            </section>
            <section className={recommendedActionState?.canRun ? "strategy-action-card ready" : "strategy-action-card blocked"}>
                <div>
                    <span>建议行动</span>
                    <strong>{recommendedActionLabel || strategy?.action || plan.actionLabel}</strong>
                    <p>{recommendedActionState?.canRun ? preview : recommendedActionState?.disabledReason ?? "当前没有可映射的推荐行动"}</p>
                </div>
                <Button type="button" variant="default" className="game-primary" disabled={!canRunRecommendedAction} title={recommendedActionState?.disabledReason ?? ""} aria-label={recommendedActionLabel ? `镇务参谋建议：${recommendedActionLabel}` : "镇务参谋建议"} onClick={() => {
                    if (recommendedAction && recommendedActionState?.canRun) onRunRecommendedAction?.(recommendedAction);
                }}>{recommendedActionState?.canRun ? recommendedActionLabel : "暂不可行动"}</Button>
            </section>
            {strategy ? (
                <section className="strategy-detail-card">
                    <div>
                        <span>推荐行动</span>
                        <strong>{strategy.action}</strong>
                    </div>
                    <div>
                        <span>推荐目标</span>
                        <strong>{strategy.target}</strong>
                    </div>
                    <p>{strategy.reason}</p>
                    <p>{strategy.expected}</p>
                    <small>{strategy.nextStep}</small>
                </section>
            ) : null}
            <div className="strategy-grid">
                <article>
                    <span>推荐行动</span>
                    <strong>{strategy?.action ?? plan.actionLabel}</strong>
                    <p>{strategy?.reason ?? plan.reason}</p>
                </article>
                <article>
                    <span>推荐目标</span>
                    <strong>{strategy?.target ?? plan.targetLabel}</strong>
                    <p>{plan.targetHint}</p>
                </article>
                <article>
                    <span>风险提醒</span>
                    <strong>{plan.riskLabel}</strong>
                    <p>{strategy?.risk ?? plan.riskHint}</p>
                </article>
            </div>
        </div>
    );
}

export function TaskPanel({ save, onRunGoalAction, onRunRetentionAction }: { save: TownSave; onRunGoalAction?: (action: string, params?: { buildingId?: string }) => void; onRunRetentionAction?: (action: string) => void }) {
    const worldState = save.worldState;
    const dailyTasks = worldState.dailyTasks ?? [];
    const weeklyGoal = worldState.weeklyGoal;
    const quest = worldState.mainQuest;
    const achievements = worldState.achievements ?? [];
    const retention = worldState.retention;
    const retentionActionState = retention ? getActionState(save, retention.nextHook.action) : null;
    const retentionActionLabel = retention ? getGoalActionLabel(retention.nextHook.action, retention.nextHook.targetLabel) : "";
    const questAction = getGoalActionTarget(save, "quest");
    const weeklyAction = getGoalActionTarget(save, "weekly");
    const festivalAction = getGoalActionTarget(save, "festival");
    const achievementAction = getGoalActionTarget(save, "achievement");
    return (
        <div className="task-panel">
            <section className="task-section quest-section town-roadmap">
                <div className="section-title"><GameIcon label="星" /><h3>小镇长期进度</h3></div>
                <div className="roadmap-grid">
                    <Stat label="小镇等级" value={`Lv.${save.level}`} />
                    <Stat label="已解锁区域" value={worldState.unlockedAreas.length} />
                    <Stat label="建筑总等级" value={worldState.buildings.reduce((total, building) => total + building.level, 0)} />
                    <Stat label="成就徽章" value={achievements.length} />
                </div>
            </section>
            <GrowthLedger save={save} onRunGoalAction={onRunGoalAction} />
            {retention ? (
                <section className="task-section quest-section retention-plan">
                    <div className="section-title"><GameIcon label="灯" /><h3>下次开张</h3></div>
                    <div className="retention-plan-card">
                        <span>连续开张 {retention.streak ? `${retention.streak} 天` : "未开始"} · {retention.todayQualified ? "今日已形成有效日程" : "今日还缺一次有效行动"}</span>
                        <strong>Day {retention.nextHook.day} · {retention.nextHook.title}</strong>
                        <p>{retention.nextHook.desc}</p>
                        <small>{retention.nextHook.targetLabel} · {retention.nextHook.reason}</small>
                        {retention.nextHook.reward ? <em>{formatRetentionReward(retention.nextHook.reward)}</em> : null}
                        {onRunRetentionAction && retentionActionState ? (
                            <div className="retention-action-row">
                                <Button type="button" variant="default" className="game-primary" disabled={!retentionActionState.canRun} title={retentionActionState.disabledReason} aria-label={`回访奖励：${retentionActionLabel}`} onClick={() => onRunRetentionAction?.(retention.nextHook.action)}>
                                    {retentionActionState.canRun ? retentionActionLabel : retentionActionState.disabledReason}
                                </Button>
                                <span>{retentionActionState.canRun ? retentionActionState.preview.join(" · ") || "完成这次行动后结算奖励" : "换个行动或休息到明天后再回来"}</span>
                            </div>
                        ) : null}
                    </div>
                </section>
            ) : null}
            <section className="task-section quest-section">
                <div className="section-title"><GameIcon label="冠" /><h3>主线目标</h3></div>
                {quest ? (
                    <div className="quest-card">
                        <strong>第 {quest.chapter} 章：{quest.title}</strong>
                        <p>{quest.desc}</p>
                        <div className="task-stack">
                            {quest.requirements.map((requirement) => (
                                <ProgressRow key={requirement.type} label={formatRequirement(requirement.type)} progress={requirement.current} target={requirement.target} />
                            ))}
                        </div>
                        <GoalActionButton label="主线行动" goalAction={questAction} save={save} onRunGoalAction={onRunGoalAction} />
                    </div>
                ) : (
                    <div className="quest-empty-card">
                        <span>主线线索</span>
                        <strong>先把今日委托跑起来</strong>
                        <p>经营、拜访或探索后，新的主线章节会从小镇日志里长出来。</p>
                        <GoalActionButton label="主线线索行动" goalAction={questAction} save={save} onRunGoalAction={onRunGoalAction} />
                    </div>
                )}
            </section>
            <section className="task-section">
                <div className="section-title"><GameIcon label="任" /><h3>今日任务</h3></div>
                <div className="task-stack">
                    {dailyTasks.map((task) => (
                        <div className={task.completed ? "task-card completed" : "task-card active"} key={task.id}>
                            <div className="task-card-header">
                                <div>
                                    <span className="task-kicker">{task.completed ? "已完成委托" : "今日委托"}</span>
                                    <strong>{task.title}</strong>
                                </div>
                                <span className="task-progress-orb">{Math.min(100, Math.round((task.progress / Math.max(task.target, 1)) * 100))}%</span>
                            </div>
                            <p>{task.desc}</p>
                            <ProgressRow label="进度" progress={task.progress} target={task.target} />
                            <div className="task-reward-strip" aria-label="任务奖励">
                                <span>金币 +{task.reward.coins ?? 0}</span>
                                <span>体力 +{task.reward.stamina ?? 0}</span>
                                <span>声望 +{task.reward.reputation ?? 0}</span>
                            </div>
                            <TaskActionButton key={task.id} onRunGoalAction={onRunGoalAction} save={save} task={task} />
                            {task.completed ? <span className="task-check">✓</span> : null}
                        </div>
                    ))}
                </div>
            </section>
            <section className="task-section">
                <div className="section-title"><GameIcon label="周" /><h3>周目标</h3></div>
                {weeklyGoal ? (
                    <div className={weeklyGoal.completed ? "task-card completed" : "task-card"}>
                        <strong>{weeklyGoal.title}</strong>
                        <p>{weeklyGoal.desc}</p>
                        <ProgressRow label="本周" progress={weeklyGoal.progress} target={weeklyGoal.target} />
                        <GoalActionButton label="周目标行动" goalAction={weeklyAction} save={save} onRunGoalAction={onRunGoalAction} />
                    </div>
                ) : (
                    <div className="quest-empty-card">
                        <span>本周路线</span>
                        <strong>休息结算后刷新周目标</strong>
                        <p>今天先完成一次有效行动，再用休息结算开启下一段周路线。</p>
                        <GoalActionButton label="周路线行动" goalAction={weeklyAction} save={save} onRunGoalAction={onRunGoalAction} />
                    </div>
                )}
            </section>
            {festivalAction ? (
                <section className="task-section festival-action-section">
                    <div className="section-title"><GameIcon label="庆" /><h3>小镇活动</h3></div>
                    <div className="task-card festival-action-card">
                        <strong>{worldState.activeFestival?.title}</strong>
                        <p>{worldState.activeFestival?.desc}</p>
                        {worldState.activeFestival ? <ProgressRow label={formatFestivalAction(worldState.activeFestival.action)} progress={worldState.activeFestival.progress} target={worldState.activeFestival.target} /> : null}
                        <GoalActionButton label="活动行动" goalAction={festivalAction} save={save} onRunGoalAction={onRunGoalAction} />
                    </div>
                </section>
            ) : null}
            <section className="task-section">
                <div className="section-title"><GameIcon label="章" /><h3>成就徽章</h3></div>
                {achievements.length ? (
                    <div className="achievement-board">
                        {achievements.map((item, index) => (
                            <article className="achievement-badge-card" key={item}>
                                <span className="achievement-stamp">{index + 1}</span>
                                <strong>{item}</strong>
                                <small>已写入小镇成就册</small>
                            </article>
                        ))}
                        <article className="achievement-next-card">
                            <span>下一枚徽章</span>
                            <strong>继续收集小镇故事</strong>
                            <p>把经营、拜访和主线推进串起来，下一枚徽章会更像你的玩法风格。</p>
                            <GoalActionButton label="继续收集徽章" goalAction={achievementAction} save={save} onRunGoalAction={onRunGoalAction} />
                        </article>
                    </div>
                ) : (
                    <div className="achievement-empty-card">
                        <span>第一枚徽章</span>
                        <strong>把今天的经营写进成就册</strong>
                        <p>完成委托、升级建筑或推进主线后，徽章会记录你的小镇风格。</p>
                        <GoalActionButton label="徽章行动" goalAction={achievementAction} save={save} onRunGoalAction={onRunGoalAction} />
                    </div>
                )}
            </section>
        </div>
    );
}

function GrowthLedger({ save, onRunGoalAction }: { save: TownSave; onRunGoalAction?: (action: string, params?: { buildingId?: string }) => void }) {
    const lanes = createGrowthLedgerLanes(save);
    return (
        <section className="task-section quest-section growth-ledger" aria-label="成长册">
            <div className="section-title"><GameIcon label="册" /><h3>成长册</h3></div>
            <p className="growth-ledger-copy">这些是适合商业化的玩法价值，但当前只做预览，不直接售卖数值优势。</p>
            <div className="growth-lane-grid">
                {lanes.map((lane) => {
                    const actionState = getActionState(save, lane.action, lane.buildingId);
                    return (
                        <article className="growth-lane" key={lane.label}>
                            <div>
                                <span>{lane.label}</span>
                                <strong>{lane.value}%</strong>
                            </div>
                            <div className="growth-lane-track"><i style={{ width: `${lane.value}%` }} /></div>
                            <p>{lane.desc}</p>
                            <Button type="button" variant="outline" className="growth-lane-action" disabled={!onRunGoalAction || !actionState.canRun} title={actionState.disabledReason || lane.reason} aria-label={`${lane.label}：${lane.actionLabel}`} onClick={() => onRunGoalAction?.(lane.action, lane.buildingId ? { buildingId: lane.buildingId } : undefined)}>
                                {actionState.canRun ? lane.actionLabel : actionState.disabledReason}
                            </Button>
                        </article>
                    );
                })}
            </div>
            <small className="growth-ledger-note">当前为成长预览，正式扣费、订阅权益和失败退款接入后才会开放购买。</small>
        </section>
    );
}

function createGrowthLedgerLanes(save: TownSave) {
    const storyDepth = Math.min(100, save.level * 18 + (save.worldState.mainQuest?.chapter ?? 1) * 8);
    const memoryDepth = Math.min(100, getMemoryPromiseCount(save) * 18 + save.characters.length * 10);
    const chapterDepth = Math.min(100, (save.worldState.mainQuest?.chapter ?? 1) * 24 + (save.worldState.achievements?.length ?? 0) * 10);
    const seasonDepth = Math.min(100, (save.worldState.activeFestival?.progress ?? 0) * 22 + save.worldState.unlockedAreas.length * 12);
    const styleDepth = Math.min(100, save.worldState.buildings.reduce((total, building) => total + building.level, 0) * 8);
    return [
        { label: "故事深度", value: storyDepth, desc: "主线章节、事件分支和参谋计划会逐步变密。", action: "advice", actionLabel: "安排计划", reason: "先让镇务参谋安排下一步。" },
        { label: "记忆容量", value: memoryDepth, desc: "居民偏好、约定和关键时刻会影响后续行动。", action: "visit", actionLabel: "拜访居民", reason: "拜访居民能留下新的记忆线索。" },
        { label: "角色章节", value: chapterDepth, desc: "关系推进后打开更多居民专属小事件。", action: "operate", actionLabel: "经营餐馆", reason: "稳定经营能支撑后续角色章节。" },
        { label: "季节活动", value: seasonDepth, desc: "活动筹备会把经营、拜访和探索串成阶段目标。", action: "explore", actionLabel: "探索街区", reason: "探索街区会发现活动线索。" },
        { label: "外观表达", value: styleDepth, desc: "建筑等级和布置路线会改变小镇呈现。", action: "decorate", actionLabel: "布置小镇", reason: "布置小镇能推进外观表达。" },
    ];
}

function getTaskActionTarget(save: TownSave, task: TownSave["worldState"]["dailyTasks"][number]): TownGoalActionTarget | null {
    if (task.completed) return null;
    const action = getActionForTaskType(task.type);
    const buildingId = action === "upgrade" ? save.worldState.buildings.find((building) => building.level < (building.maxLevel ?? 5))?.id : undefined;
    return {
        action,
        buildingId,
        targetLabel: task.title,
        reason: task.desc,
    };
}

function TaskActionButton({ onRunGoalAction, save, task }: { onRunGoalAction?: (action: string, params?: { buildingId?: string }) => void; save: TownSave; task: TownSave["worldState"]["dailyTasks"][number] }) {
    const target = getTaskActionTarget(save, task);
    if (!target) return null;
    const actionState = getActionState(save, target.action, target.buildingId);
    const taskActionLabel = getGoalActionLabel(target.action, target.targetLabel);
    return (
        <div className="task-action-row">
            <Button type="button" variant="default" className="game-primary task-action-button" disabled={!onRunGoalAction || !actionState.canRun} title={actionState.disabledReason || target.reason} aria-label={`${task.title}：${taskActionLabel}`} onClick={() => onRunGoalAction?.(target.action, target.buildingId ? { buildingId: target.buildingId } : undefined)}>
                {actionState.canRun ? taskActionLabel : actionState.disabledReason}
            </Button>
            <span className="task-action-copy">{taskActionLabel} · {actionState.canRun ? target.reason : "先换个行动或休息到明天"}</span>
        </div>
    );
}

function GoalActionButton({ goalAction, label, onRunGoalAction, save }: { goalAction: TownGoalActionTarget | null; label: string; onRunGoalAction?: (action: string, params?: { buildingId?: string }) => void; save: TownSave }) {
    if (!goalAction) return null;
    const actionState = getActionState(save, goalAction.action, goalAction.buildingId);
    const goalActionLabel = getGoalActionLabel(goalAction.action, goalAction.targetLabel);
    return (
        <div className="goal-action-row">
            <Button type="button" variant="default" className="game-primary" disabled={!onRunGoalAction || !actionState.canRun} title={actionState.disabledReason || goalAction.reason} aria-label={`${label}：${goalActionLabel}`} onClick={() => onRunGoalAction?.(goalAction.action, goalAction.buildingId ? { buildingId: goalAction.buildingId } : undefined)}>
                {actionState.canRun ? goalActionLabel : actionState.disabledReason}
            </Button>
            <span>{goalActionLabel} · {actionState.canRun ? goalAction.reason : "先换个行动或休息到明天"}</span>
        </div>
    );
}

export function CompactGoalBoard({ goal, save, onOpenEvents, onOpenSettlement, onOpenTasks }: { goal: TownGoalViewModel; save: TownSave; onOpenEvents: () => void; onOpenSettlement: () => void; onOpenTasks: () => void }) {
    const festival = save.worldState.activeFestival;
    const festivalLabel = festival ? formatFestivalStatus(festival.status) : "活动线索";
    const festivalTitle = festival ? festival.title : "探索街区";
    const festivalHint = festival ? `剩余 ${festival.daysLeft} 天 · 金币 ${festival.reward.coins ?? 0} · 声望 ${festival.reward.reputation ?? 0}` : "打开委托册找下一条活动线索";
    return (
        <div className="compact-goal-board">
            <div className="goal-chip primary">
                <span>推荐目标</span>
                <strong>{goal.primary.title}</strong>
                <small>{goal.primary.desc}</small>
            </div>
            <div className="goal-chip-strip">
                <div className="goal-chip mini">
                    <span>任务</span>
                    <strong>{goal.dailyOpen}/{goal.dailyTotal}</strong>
                    <small>{goal.nextTaskTitle}</small>
                </div>
                <div className="goal-chip mini">
                    <span>行动</span>
                    <strong>{goal.actionBudget.label}</strong>
                    <small>已用 {goal.actionBudget.used}</small>
                </div>
                <div className="goal-chip mini retention-chip">
                    <span>连续</span>
                    <strong>{goal.retention.label}</strong>
                    <small>{goal.retention.todayQualified ? "有效日程" : goal.retention.nextHook.reward ? formatRetentionReward(goal.retention.nextHook.reward) : goal.retention.nextHook.title}</small>
                </div>
                <Button type="button" variant="ghost" className="goal-chip mini festival-clue" aria-label={festival ? `小镇活动：${festival.title}，${festivalHint}` : "活动线索：探索街区，打开委托册找下一条活动线索"} onClick={onOpenTasks}>
                    <span>{festivalLabel}</span>
                    <strong>{festivalTitle}</strong>
                    <small>{festivalHint}</small>
                    <span>追踪线索</span>
                </Button>
            </div>
            <div className="goal-chip companion">
                <span>镇务参谋</span>
                <strong>{goal.companionMessage}</strong>
                {goal.memoryPromiseCount ? <small>待回应约定 {goal.memoryPromiseCount} 条</small> : null}
            </div>
            <div className="goal-chip-actions">
                <Button type="button" variant="ghost" onClick={onOpenTasks}><GameIcon label="任" /><span>任务</span></Button>
                <Button type="button" variant="ghost" onClick={onOpenEvents}><GameIcon label="志" /><span>日志</span></Button>
                <Button type="button" variant="ghost" onClick={onOpenSettlement}><GameIcon label="月" /><span>日结</span></Button>
            </div>
        </div>
    );
}

export function StageTurnStrip({ save, goal, recommendedAction, onOpenTasks }: { save: TownSave; goal: TownGoalViewModel; recommendedAction: string | null; onOpenTasks: () => void }) {
    const targetLabel = getRecommendedTarget(save) ?? goal.primary.title;
    const actionLabel = recommendedAction ? getGoalActionLabel(recommendedAction, targetLabel) : "打开委托册";
    const budgetLabel = `${goal.actionBudget.remaining}/${goal.actionBudget.maxPerDay}`;
    return (
        <div className="stage-turn-strip" role="status" aria-live="polite">
            <div className="turn-strip-day">
                <span>Day</span>
                <strong>{save.day}</strong>
            </div>
            <div className="turn-strip-budget">
                <span>今日行动</span>
                <strong>{budgetLabel}</strong>
                <small>已用 {goal.actionBudget.used}</small>
            </div>
            <div className="turn-strip-recommendation">
                <span>推荐动作</span>
                <strong>{actionLabel}</strong>
                <small>{goal.companionMessage}</small>
            </div>
            <div className="turn-strip-next-goal">
                <span>下一目标</span>
                <strong>{goal.primary.title}</strong>
                <small>{goal.primary.desc}</small>
            </div>
            <Button type="button" variant="ghost" onClick={onOpenTasks}>打开委托册</Button>
        </div>
    );
}

function ActionPreviewList({ items }: { items: Array<{ title: string; state: ReturnType<typeof getActionState> } | null> }) {
    const visibleItems = items.filter((item): item is { title: string; state: ReturnType<typeof getActionState> } => Boolean(item));
    return (
        <div className="action-preview-list">
            {visibleItems.map(({ title, state }) => (
                <div className={state.canRun ? "action-preview-row" : "action-preview-row blocked"} key={title}>
                    <span>{title}</span>
                    <strong>{state.canRun ? state.preview.join(" · ") || "可以出发" : state.disabledReason}</strong>
                </div>
            ))}
        </div>
    );
}

function mapStrategyAction(action: string) {
    if (action.includes("经营")) return "operate";
    if (action.includes("拜访")) return "visit";
    if (action.includes("探索")) return "explore";
    if (action.includes("休息")) return "rest";
    if (action.includes("升级")) return "upgrade";
    if (action.includes("布置")) return "decorate";
    return null;
}

function mapPlanAction(actionLabel: string) {
    if (actionLabel.includes("经营")) return "operate";
    if (actionLabel.includes("拜访")) return "visit";
    if (actionLabel.includes("探索")) return "explore";
    if (actionLabel.includes("休息")) return "rest";
    if (actionLabel.includes("升级")) return "upgrade";
    if (actionLabel.includes("布置")) return "decorate";
    return null;
}

export function CommandSummary({ commands, pending, onRun }: { commands: TownCommandViewModel[]; pending: boolean; onRun: (action: string) => void }) {
    return (
        <div className="command-summary">
            {commands.map((action) => (
                <Button type="button" variant="ghost" className={`command-card ${action.recommended ? "recommended" : ""}${action.taskLinked ? " task-linked" : ""}${!action.canRun ? " blocked" : ""}`} key={action.id} disabled={pending || !action.canRun} title={action.disabledReason} aria-label={getCommandAriaLabel(action)} onClick={() => onRun(action.id)}>
                    <span className="command-card-topline">
                        {action.recommended ? <i className="command-recommend-marker">推荐</i> : null}
                        {action.taskLinked ? <i className="action-badge">任务</i> : null}
                    </span>
                    <GameIcon label={action.icon} />
                    <strong>{action.title}</strong>
                    <small className="command-preview">{action.canRun ? action.preview[0] ?? action.desc : action.disabledReason}</small>
                    <em className="command-budget">{action.canRun ? action.hint : "行动受限"}</em>
                </Button>
            ))}
        </div>
    );
}

function getCommandAriaLabel(action: TownCommandViewModel) {
    const status = [
        action.recommended ? "今日推荐" : "",
        action.taskLinked ? "关联任务" : "",
        action.preview.join(" · ") || action.desc,
        action.canRun ? action.hint : "行动受限",
        action.canRun ? "" : action.disabledReason,
    ].filter(Boolean);
    return `${action.title}：${status.join("，")}`;
}

function ProgressRow({ label, progress, target }: { label: string; progress: number; target: number }) {
    const percent = target > 0 ? Math.min(100, Math.round((progress / target) * 100)) : 0;
    return (
        <div className="progress-row">
            <div><span>{label}</span><strong>{progress} / {target}</strong></div>
            <div className="progress-track"><span style={{ width: `${percent}%` }} /></div>
        </div>
    );
}

function RelationshipBar({ value, compact = false }: { value: number; compact?: boolean }) {
    const percent = Math.min(100, Math.max(0, value));
    return (
        <div className={compact ? "relationship-bar compact" : "relationship-bar"}>
            <div><span>{getRelationshipLevel(value)}</span><strong>{value}/100</strong></div>
            <div className="relationship-track"><i style={{ width: `${percent}%` }} /></div>
        </div>
    );
}

export function SettlementPanel({ onRest, save }: { onRest?: () => void; save: TownSave }) {
    const settlement = save.worldState.lastSettlement;
    if (!settlement) {
        return (
            <div className="settlement-empty-card">
                <span>夜间账本</span>
                <strong>今天还没有日结</strong>
                <p>经营、拜访或探索后，可以休息结算，把收入、维护、声望和第二天目标写进小镇。</p>
                {onRest ? <Button type="button" variant="default" className="game-primary" onClick={onRest}>休息结算</Button> : null}
            </div>
        );
    }
    return (
        <div className="settlement-panel">
            <AssetImage src={ASSETS.banner} alt="夜晚小镇" className="settlement-art" />
            <div className="settlement-cards">
                <Stat label="结算日" value={`Day ${settlement.day}`} />
                <Stat label="天气" value={settlement.weather} />
                <Stat label="收入" value={`+${settlement.income}`} />
                <Stat label="维护" value={`-${settlement.maintenance}`} />
                <Stat label="声望" value={`+${settlement.reputation}`} />
            </div>
            {settlement.breakdown?.length ? (
                <div className="settlement-breakdown">
                    {settlement.breakdown.map((item) => (
                        <article className={item.value >= 0 ? "positive" : "negative"} key={`${item.label}-${item.detail}`}>
                            <span>{item.label}</span>
                            <strong>{item.value > 0 ? "+" : ""}{item.value}</strong>
                            <small>{item.detail}</small>
                        </article>
                    ))}
                </div>
            ) : null}
            <p>{settlement.summary}</p>
        </div>
    );
}

export function GameModalShell({ children, title, onClose }: { children: React.ReactNode; title: string; onClose: () => void }) {
    const shouldReduceMotion = useReducedMotion();
    const titleId = `game-drawer-title-${slugifyGameModalTitle(title)}`;
    const closeLabel = `收起${title}面板`;
    const drawerRef = useRef<HTMLElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);
    const previousBodyOverflowRef = useRef("");

    useEffect(() => {
        previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        previousBodyOverflowRef.current = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        drawerRef.current?.focus();

        return () => {
            document.body.style.overflow = previousBodyOverflowRef.current;
            previousFocusRef.current?.focus();
        };
    }, []);

        return (
            <motion.div className="game-drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
                <motion.section className="game-drawer" ref={drawerRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} initial={{ opacity: 0, x: shouldReduceMotion ? 0 : 48 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: shouldReduceMotion ? 0 : 36 }} transition={{ duration: 0.18 }} onKeyDown={(event) => handleGameDrawerKeyDown(event, onClose)} onClick={(event) => event.stopPropagation()}>
                <header>
                    <h2 id={titleId}>{title}</h2>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={closeLabel} onClick={onClose}>×</Button>
                </header>
                {children}
            </motion.section>
        </motion.div>
    );
}

function slugifyGameModalTitle(title: string) {
    return title.trim().toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, "-").replace(/^-+|-+$/g, "") || "panel";
}

function handleGameDrawerKeyDown(event: React.KeyboardEvent<HTMLElement>, onClose: () => void) {
    keepGameDrawerFocusInside(event);
    if (event.key !== "Escape") return;
    event.stopPropagation();
    onClose();
}

function keepGameDrawerFocusInside(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const drawer = event.currentTarget;
    const focusableElements = Array.from(drawer.querySelectorAll<HTMLElement>(GAME_DRAWER_FOCUSABLE_SELECTOR)).filter((element) => !element.hasAttribute("disabled") && element.tabIndex !== -1);
    if (!focusableElements.length) {
        event.preventDefault();
        drawer.focus();
        return;
    }
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
    }
    if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
    }
}

export function ResourcePill({ label, value }: { label: string; value: string | number }) {
    return <div className="resource-pill"><span>{label}</span><strong>{value}</strong></div>;
}

export function ResourceMeter({ label, value, max }: { label: string; value: number; max: number }) {
    const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
    return (
        <div className="resource-pill resource-meter">
            <span>{label}</span>
            <strong>{value}</strong>
            <div className="resource-meter-track"><i style={{ width: `${percent}%` }} /></div>
        </div>
    );
}

export function GoalBoard({ save, onOpenEvents, onOpenSettlement, onOpenTasks }: { save: TownSave; onOpenEvents: () => void; onOpenSettlement: () => void; onOpenTasks: () => void }) {
    const task = save.worldState.dailyTasks?.find((item) => !item.completed) ?? save.worldState.dailyTasks?.[0] ?? null;
    const unlock = getNextUnlockGoal(save);
    return (
        <aside className="goal-board">
            <section className="goal-card primary-goal">
                <div className="goal-card-title"><GameIcon label="任" /><span>今日目标</span></div>
                {task ? (
                    <>
                        <strong>{task.title}</strong>
                        <p>{task.desc}</p>
                        <ProgressRow label="进度" progress={task.progress} target={task.target} />
                        <small>奖励：金币 {task.reward.coins ?? 0} · 体力 {task.reward.stamina ?? 0} · 声望 {task.reward.reputation ?? 0}</small>
                    </>
                ) : <p>今天的小镇目标都完成了，适合休息进入明天。</p>}
            </section>
            <section className="goal-card unlock-goal">
                <div className="goal-card-title"><GameIcon label="建" /><span>下一建设</span></div>
                <strong>{unlock.title}</strong>
                <p>{unlock.desc}</p>
                <ProgressRow label={unlock.label} progress={unlock.progress} target={unlock.target} />
            </section>
            <div className="goal-shortcuts">
                <Button type="button" variant="ghost" onClick={onOpenTasks}><GameIcon label="任" /><span>任务</span></Button>
                <Button type="button" variant="ghost" onClick={onOpenEvents}><GameIcon label="志" /><span>日志</span></Button>
                <Button type="button" variant="ghost" onClick={onOpenSettlement}><GameIcon label="月" /><span>日结</span></Button>
            </div>
            <FestivalGoalCard save={save} />
        </aside>
    );
}

function FestivalGoalCard({ save }: { save: TownSave }) {
    const festival = save.worldState.activeFestival;
    if (!festival) {
        return (
            <section className="goal-card festival-goal">
                <div className="goal-card-title"><GameIcon label="庆" /><span>小镇活动</span></div>
                <strong>探索街区</strong>
                <p>打开委托册追踪活动线索；升级建筑、提升声望或探索街区后，会出现新的限时活动。</p>
            </section>
        );
    }
    return (
        <section className="goal-card festival-goal active">
            <div className="goal-card-title"><GameIcon label="庆" /><span>{formatFestivalStatus(festival.status)}</span></div>
            <strong>{festival.title}</strong>
            <p>{festival.desc}</p>
            <ProgressRow label={formatFestivalAction(festival.action)} progress={festival.progress} target={festival.target} />
            <small>剩余 {festival.daysLeft} 天 · 奖励：金币 {festival.reward.coins ?? 0} · 声望 {festival.reward.reputation ?? 0}</small>
        </section>
    );
}

export function GameIcon({ label }: { label: string }) {
    return <span aria-hidden="true" className="inline-game-icon">{label}</span>;
}

export function getModalTitle(modal: GameModal, building: TownBuilding | null, character: TownCharacter | null) {
    if (modal === "building") return building?.name ?? "建筑";
    if (modal === "npc") return character ? `和${character.name}聊天` : "居民";
    if (modal === "events") return "小镇日志";
    if (modal === "advice") return "今日计划";
    if (modal === "settlement") return "每日结算";
    if (modal === "tasks") return "任务与目标";
    if (modal === "event") return "小镇事件";
    if (modal === "ai-confirm") return "额度提示";
    return "小镇";
}

function EventImage({ eventType }: { eventType: string }) {
    const src = eventType === "operate" || eventType === "upgrade" ? ASSETS.screenshots.kitchen : eventType === "chat" || eventType === "visit" || eventType === "relationship" || eventType === "npc_story" || eventType === "memory_promise" ? ASSETS.screenshots.npc : eventType === "explore" || eventType === "unlock" || eventType === "festival" ? ASSETS.screenshots.nightEvent : ASSETS.screenshots.town;
    return <AssetImage src={src} alt="事件插图" className="event-image" />;
}

function formatRuleRef(rule: string) {
    if (rule === "rule:resource-delta") return "资源结算";
    if (rule === "rule:daily-settlement") return "每日结算";
    if (rule === "rule:building-income") return "建筑收入";
    if (rule === "rule:building-maintenance") return "建筑维护";
    if (rule === "rule:building-upgrade") return "建筑升级";
    if (rule === "rule:strategy-advice") return "今日计划";
    if (rule === "rule:relationship-target") return "居民关系";
    if (rule === "rule:daily-action-budget") return "行动预算";
    if (rule === "rule:npc-memory") return "居民记忆";
    if (rule === "rule:retention-reward") return "回访奖励";
    if (rule === "model:assisted") return "参谋参与";
    if (rule === "model:fallback") return "规则补位";
    if (rule.startsWith("action:")) return `行动：${formatActionRef(rule.slice("action:".length))}`;
    if (rule.startsWith("choice:")) return "事件选择";
    if (rule.startsWith("building:")) return "建筑目标";
    return rule;
}

function formatAuditSource(source: string) {
    if (source === "model-assisted") return "参谋参与";
    if (source === "settlement") return "日结规则";
    return "固定规则";
}

function formatActionRef(action: string) {
    if (action === "operate") return "经营";
    if (action === "visit") return "拜访";
    if (action === "decorate") return "布置";
    if (action === "explore") return "探索";
    if (action === "rest") return "休息";
    if (action === "upgrade") return "升级";
    if (action === "advice") return "计划";
    return action;
}

function formatRetentionReward(reward: NonNullable<TownSave["worldState"]["retention"]>["nextHook"]["reward"]) {
    if (!reward) return "";
    const parts = [
        reward.coins ? `金币 +${reward.coins}` : null,
        reward.stamina ? `体力 +${reward.stamina}` : null,
        reward.reputation ? `声望 +${reward.reputation}` : null,
    ].filter(Boolean);
    return `${reward.label}：${parts.join(" · ") || "小镇状态提升"}`;
}

export function ResultBar({ event }: { event: TownEvent }) {
    const result = event.result;
    if (!result) return null;

    const items = [
        ["金币", result.coins],
        ["体力", result.stamina],
        ["声望", result.reputation],
    ].filter(([, value]) => typeof value === "number" && value !== 0) as Array<[string, number]>;

    if (!items.length && !result.relationship) return null;

    return (
        <div className="result-bar">
            {items.map(([label, value]) => (
                <span className={value > 0 ? "positive" : "negative"} key={label}>{label} {value > 0 ? "+" : ""}{value}</span>
            ))}
            {result.relationship ? <span className="positive">关系 +{Object.values(result.relationship)[0]}</span> : null}
            {result.bonuses?.map((bonus) => <span className="positive" key={bonus}>{bonus}</span>)}
        </div>
    );
}

export function RewardToast({ event }: { event: TownEvent }) {
    return (
        <div className="reward-toast" role="status" aria-live="polite" aria-atomic="true">
            <span className="reward-toast-kicker">行动结算</span>
            <strong className="reward-toast-title">{event.title}</strong>
            <small className="reward-toast-summary">{getResultSummary(event)}</small>
            <ResultBar event={event} />
        </div>
    );
}

function Stat({ label, value }: { label: string; value: string | number }) {
    return <div className="stat-card"><span>{label}</span><strong>{value}</strong></div>;
}
