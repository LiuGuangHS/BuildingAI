import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@buildingai/ui/components/ui/alert-dialog";
import { Button } from "@buildingai/ui/components/ui/button";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { motion } from "framer-motion";

import { ASSETS, getNpcAsset } from "../assets";
import { createCompanionMessage, formatEventType, formatFestivalAction, formatFestivalStatus, formatRequirement, getBuildingActionCopy, getChoicePreview, getChoiceTone, getNextUnlockGoal, getRelationshipBenefit, getRelationshipLevel, getResultSummary, getStrategyPlan, getUpgradeCost, groupEvents, isAiEventType } from "../lib/game-rules";
import type { TownBuilding, TownCharacter, TownEvent, TownSave, TownSaveListResult } from "../services/types";
import type { TownCommandViewModel, TownGoalViewModel } from "../lib/town-view-model";
import { getActionState } from "../lib/town-view-model";
import { AssetImage } from "./asset-image";

type SaveSummary = TownSaveListResult["list"][number];
export type GameModal = "building" | "npc" | "event" | "events" | "advice" | "settlement" | "tasks" | "ai-confirm" | null;

export function SavePicker({ saves, pendingId, onDelete, onLoad }: { saves: SaveSummary[]; pendingId?: string; onDelete: (saveId: string) => void; onLoad: (saveId: string) => void }) {
    return (
        <div className="save-picker game-save-picker">
            <div className="save-picker-header">
                <h3>继续旧存档</h3>
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
                            <Button type="button" variant="outline" className="ghost-button" disabled={pendingId === save.id} onClick={() => onLoad(save.id)}>
                                {pendingId === save.id ? "载入中" : "继续"}
                            </Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button type="button" variant="destructive" className="danger-button">删除</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>删除存档</AlertDialogTitle>
                                        <AlertDialogDescription>确认删除「{save.name}」吗？此操作不可恢复。</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>取消</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => onDelete(save.id)}>删除</AlertDialogAction>
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

export function NpcPanel({ activeCharacter, chatText, lastReply, pending, save, setActiveCharacter, setChatText, onChat }: { activeCharacter: TownCharacter | null; chatText: string; lastReply: string; pending: boolean; save: TownSave; setActiveCharacter: (character: TownCharacter) => void; setChatText: (value: string) => void; onChat: () => void }) {
    return (
        <div className="npc-dialogue-layout">
            <div className="npc-roster">
                {save.characters.map((character) => (
                    <Button type="button" variant="ghost" className={activeCharacter?.id === character.id ? "active" : ""} key={character.id} onClick={() => setActiveCharacter(character)}>
                        <AssetImage src={getNpcAsset(character.role)} alt={character.name} className="avatar-image" fallback={<span className="avatar">{character.name.slice(0, 1)}</span>} />
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
                            <AssetImage src={getNpcAsset(activeCharacter.role)} alt={activeCharacter.name} className="npc-profile-avatar" fallback={<span className="avatar">{activeCharacter.name.slice(0, 1)}</span>} />
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
                <p className="ai-usage-note">居民回复会调用管理员配置的模型生成，可能消耗额度。</p>
                <Textarea value={chatText} onChange={(event) => setChatText(event.target.value)} />
                <Button type="button" disabled={!activeCharacter || pending} onClick={onChat}>{pending ? "交流中..." : "和居民聊天"}</Button>
                {lastReply ? <p>{lastReply}</p> : <p>选择一个居民，输入想聊的话题。启用后会以角色身份回复。</p>}
            </div>
        </div>
    );
}

export function NpcHotspotAvatar({ character }: { character: TownCharacter }) {
    return <AssetImage src={getNpcAsset(character.role)} alt={character.name} className="npc-hotspot-avatar" fallback={<span>{character.name.slice(0, 1)}</span>} />;
}

export function EventPanel({ events, pending, save, onChoice }: { events: TownEvent[]; pending: boolean; save: TownSave; onChoice: (choiceId: string) => void }) {
    const groupedEvents = groupEvents(events);
    return (
        <div className="event-list game-event-list">
            {groupedEvents.map((group) => (
                <section className="event-history-group" key={group.title}>
                    <h3>{group.title}</h3>
                    <div className="event-history-grid">
                        {group.events.map((event) => (
                            <article key={event.id}>
                                <EventImage eventType={event.type} />
                                <span>{formatEventType(event.type)}</span>
                                <h4>{event.title}</h4>
                                <p>{event.content}</p>
                                {event.result ? <ResultBar event={event} /> : null}
                                {event.choices?.length ? (
                                    <div className="event-choices compact-choices">
                                        {event.choices.map((choice) => (
                                            <ChoiceButton choice={choice} disabled={pending} key={choice.id} save={save} onChoice={onChoice} />
                                        ))}
                                    </div>
                                ) : null}
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
    return (
        <Button type="button" variant="ghost" className={`choice-${getChoiceTone(choice.id)}`} disabled={disabled || !actionState.canRun} title={actionState.disabledReason} onClick={() => onChoice(choice.id)}>
            <strong>{choice.label}</strong>
            <small>{actionState.canRun ? choice.hint : actionState.disabledReason}</small>
            {actionState.preview.length ? <span className="choice-preview">{actionState.preview.join(" · ")}</span> : null}
        </Button>
    );
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
                        {audit.model?.fallbackUsed ? <span>规则补位</span> : audit.model?.assisted ? <span>参谋生成</span> : null}
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

export function AiCompanion({ save, pending, onOpenAdvice }: { save: TownSave; pending: boolean; onOpenAdvice: () => void }) {
    return (
        <Button type="button" variant="ghost" className={pending ? "ai-companion thinking" : "ai-companion"} onClick={onOpenAdvice}>
            <AssetImage src={ASSETS.npcs.cat} alt="小镇参谋" className="ai-companion-avatar" fallback={<span>参谋</span>} />
            <span>
                <strong>{pending ? "思考中..." : "镇务参谋"}</strong>
                <small>{createCompanionMessage(save)}</small>
            </span>
        </Button>
    );
}

export function AiUsageConfirmCard({ onAccept, onCancel }: { onAccept: () => void; onCancel: () => void }) {
    return (
        <div className="ai-confirm-card">
            <AssetImage src={ASSETS.npcs.cat} alt="小镇参谋" className="ai-confirm-avatar" fallback={<span>参谋</span>} />
            <div>
                <p className="game-eyebrow">镇务参谋提示</p>
                <h3>生成今日计划</h3>
                <p>镇务参谋会调用管理员配置的模型生成计划，可能消耗你的额度。</p>
                <div className="panel-actions">
                    <Button type="button" variant="default" className="game-primary" onClick={onAccept}>继续</Button>
                    <Button type="button" variant="outline" className="game-secondary" onClick={onCancel}>暂不使用</Button>
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
    const canRunRecommendedAction = Boolean(onRunRecommendedAction && recommendedActionState?.canRun);
    const preview = recommendedActionState?.preview.length ? recommendedActionState.preview.join(" · ") : "查看当前目标后再行动";
    return (
        <div className="strategy-panel">
            <section className="strategy-hero">
                <AssetImage src={ASSETS.npcs.cat} alt="小镇参谋" className="strategy-avatar" fallback={<span>参谋</span>} />
                <div>
                    <p className="game-eyebrow">镇务参谋</p>
                    <h3>今日计划</h3>
                    <p>{advice}</p>
                    <p className="ai-usage-note">智能建议会调用管理员配置的模型生成，可能消耗额度。</p>
                </div>
            </section>
            <section className={recommendedActionState?.canRun ? "strategy-action-card ready" : "strategy-action-card blocked"}>
                <div>
                    <span>推荐执行</span>
                    <strong>{strategy?.action ?? plan.actionLabel}</strong>
                    <p>{recommendedActionState?.canRun ? preview : recommendedActionState?.disabledReason ?? "当前没有可映射的推荐行动"}</p>
                </div>
                <Button type="button" variant="default" className="game-primary" disabled={!canRunRecommendedAction} title={recommendedActionState?.disabledReason ?? ""} onClick={() => {
                    if (recommendedAction && recommendedActionState?.canRun) onRunRecommendedAction?.(recommendedAction);
                }}>{recommendedActionState?.canRun ? "执行推荐行动" : "暂不可执行"}</Button>
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

export function TaskPanel({ save }: { save: TownSave }) {
    const worldState = save.worldState;
    const dailyTasks = worldState.dailyTasks ?? [];
    const weeklyGoal = worldState.weeklyGoal;
    const quest = worldState.mainQuest;
    const achievements = worldState.achievements ?? [];
    const retention = worldState.retention;
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
            {retention ? (
                <section className="task-section quest-section retention-plan">
                    <div className="section-title"><GameIcon label="灯" /><h3>下次开张</h3></div>
                    <div className="retention-plan-card">
                        <span>连续开张 {retention.streak ? `${retention.streak} 天` : "未开始"} · {retention.todayQualified ? "今日已形成有效日程" : "今日还缺一次有效行动"}</span>
                        <strong>Day {retention.nextHook.day} · {retention.nextHook.title}</strong>
                        <p>{retention.nextHook.desc}</p>
                        <small>{retention.nextHook.targetLabel} · {retention.nextHook.reason}</small>
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
                    </div>
                ) : <p className="empty-panel-text">主线正在整理中。</p>}
            </section>
            <section className="task-section">
                <div className="section-title"><GameIcon label="任" /><h3>今日任务</h3></div>
                <div className="task-stack">
                    {dailyTasks.map((task) => (
                        <div className={task.completed ? "task-card completed" : "task-card"} key={task.id}>
                            <div>
                                <strong>{task.title}</strong>
                                <p>{task.desc}</p>
                            </div>
                            <ProgressRow label="进度" progress={task.progress} target={task.target} />
                            <small>奖励：金币 {task.reward.coins ?? 0} · 体力 {task.reward.stamina ?? 0} · 声望 {task.reward.reputation ?? 0}</small>
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
                    </div>
                ) : <p className="empty-panel-text">本周目标会在休息后刷新。</p>}
            </section>
            <section className="task-section">
                <div className="section-title"><GameIcon label="章" /><h3>成就徽章</h3></div>
                {achievements.length ? <div className="achievement-list">{achievements.map((item) => <span key={item}>{item}</span>)}</div> : <p className="empty-panel-text">完成长期目标后会在这里点亮成就。</p>}
            </section>
        </div>
    );
}

export function CompactGoalBoard({ goal, onOpenEvents, onOpenSettlement, onOpenTasks }: { goal: TownGoalViewModel; onOpenEvents: () => void; onOpenSettlement: () => void; onOpenTasks: () => void }) {
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
                    <small>{goal.retention.todayQualified ? "有效日程" : goal.retention.nextHook.title}</small>
                </div>
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

function ActionPreviewList({ items }: { items: Array<{ title: string; state: ReturnType<typeof getActionState> } | null> }) {
    const visibleItems = items.filter((item): item is { title: string; state: ReturnType<typeof getActionState> } => Boolean(item));
    return (
        <div className="action-preview-list">
            {visibleItems.map(({ title, state }) => (
                <div className={state.canRun ? "action-preview-row" : "action-preview-row blocked"} key={title}>
                    <span>{title}</span>
                    <strong>{state.canRun ? state.preview.join(" · ") || "可执行" : state.disabledReason}</strong>
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
                <Button type="button" variant="ghost" className={`${action.recommended ? "recommended" : ""}${action.taskLinked ? " task-linked" : ""}`} key={action.id} disabled={pending || !action.canRun} title={action.disabledReason} onClick={() => onRun(action.id)}>
                    {action.taskLinked ? <span className="action-badge">任务</span> : null}
                    <GameIcon label={action.icon} />
                    <strong>{action.title}</strong>
                    <small>{action.canRun ? `${action.desc} · ${action.preview[0] ?? action.hint}` : action.disabledReason}</small>
                    <em>{action.hint}</em>
                </Button>
            ))}
        </div>
    );
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

export function SettlementPanel({ save }: { save: TownSave }) {
    const settlement = save.worldState.lastSettlement;
    if (!settlement) return <p className="empty-panel-text">休息一天后会在这里显示每日结算。</p>;
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
    return (
        <motion.div className="game-drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.section className="game-drawer" initial={{ opacity: 0, x: 48 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 36 }} transition={{ duration: 0.18 }}>
                <header>
                    <h2>{title}</h2>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="关闭" onClick={onClose}>×</Button>
                </header>
                {children}
            </motion.section>
        </motion.div>
    );
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
                <strong>等待活动线索</strong>
                <p>升级建筑、提升声望或探索街区后，会出现新的限时活动。</p>
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
    if (rule === "model:assisted") return "参谋生成";
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

function Stat({ label, value }: { label: string; value: string | number }) {
    return <div className="stat-card"><span>{label}</span><strong>{value}</strong></div>;
}
