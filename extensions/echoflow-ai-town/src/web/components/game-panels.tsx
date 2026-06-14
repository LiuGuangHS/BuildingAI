import { motion } from "framer-motion";

import { ASSETS, getNpcAsset } from "../assets";
import { createCompanionMessage, formatEventType, formatFestivalAction, formatFestivalStatus, formatRequirement, getActionAffordability, getBuildingActionCopy, getChoicePreview, getChoiceTone, getNextUnlockGoal, getRelationshipBenefit, getRelationshipLevel, getResultSummary, getStrategyPlan, getUpgradeCost, groupEvents, isAiEventType } from "../lib/game-rules";
import type { TownBuilding, TownCharacter, TownEvent, TownSave, TownSaveListResult } from "../services/types";
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
                            <button className="ghost-button" disabled={pendingId === save.id} onClick={() => onLoad(save.id)}>
                                {pendingId === save.id ? "载入中" : "继续"}
                            </button>
                            <button
                                className="danger-button"
                                onClick={() => {
                                    if (window.confirm(`确认删除「${save.name}」吗？此操作不可恢复。`)) onDelete(save.id);
                                }}
                            >
                                删除
                            </button>
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
    const actionAffordability = getActionAffordability(save, buildingAction);
    const secondaryAffordability = secondaryAction ? getActionAffordability(save, secondaryAction) : null;
    const upgradeAffordability = getActionAffordability(save, "upgrade", building.id);
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
                    <button className="game-primary" disabled={pending || !actionAffordability.canRun} title={actionAffordability.reason} onClick={() => onAction(buildingAction)}>
                        {actionAffordability.canRun ? copy.primary : actionAffordability.reason}
                    </button>
                    {secondaryAction && secondaryAffordability ? (
                        <button className="game-secondary" disabled={pending || !secondaryAffordability.canRun} title={secondaryAffordability.reason} onClick={() => onAction(secondaryAction)}>
                            {secondaryAffordability.canRun ? copy.secondary : secondaryAffordability.reason}
                        </button>
                    ) : null}
                    <button className="game-secondary" disabled={pending || isMaxLevel || !upgradeAffordability.canRun} title={upgradeAffordability.reason} onClick={() => onAction("upgrade", { buildingId: building.id })}>
                        {isMaxLevel ? "已满级" : upgradeAffordability.canRun ? `${copy.upgrade} ${cost}` : upgradeAffordability.reason}
                    </button>
                </div>
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
                    <button className={activeCharacter?.id === character.id ? "active" : ""} key={character.id} onClick={() => setActiveCharacter(character)}>
                        <AssetImage src={getNpcAsset(character.role)} alt={character.name} className="avatar-image" fallback={<span className="avatar">{character.name.slice(0, 1)}</span>} />
                        <span>
                            <strong>{character.name}</strong>
                            <small>{character.role} · {getRelationshipLevel(character.relationship)} · 关系 {character.relationship}</small>
                            <RelationshipBar value={character.relationship} compact />
                        </span>
                    </button>
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
                            <strong>记忆片段</strong>
                            <p>{activeCharacter.memory?.summary ?? "还没有形成新的聊天记忆。"}</p>
                        </div>
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
                <p className="ai-usage-note">AI 回复会调用管理员配置的模型生成，可能消耗额度。</p>
                <textarea value={chatText} onChange={(event) => setChatText(event.target.value)} />
                <button disabled={!activeCharacter || pending} onClick={onChat}>{pending ? "交流中..." : "和居民聊天"}</button>
                {lastReply ? <p>{lastReply}</p> : <p>选择一个居民，输入想聊的话题。AI 开启后会以角色身份回复。</p>}
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
                <div className="event-card-badge">{isAiEventType(event.type) ? "AI 事件" : formatEventType(event.type)}</div>
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
                <button className="game-secondary" onClick={onBack}>返回地图</button>
                {event.result ? <small>{getResultSummary(event)}</small> : <small>选择会消耗资源并推进小镇状态。</small>}
            </div>
        </article>
    );
}

function ChoiceButton({ choice, disabled, save, onChoice }: { choice: NonNullable<TownEvent["choices"]>[number]; disabled: boolean; save: TownSave; onChoice: (choiceId: string) => void }) {
    const affordability = getActionAffordability(save, choice.id);
    const preview = getChoicePreview(save, choice.id);
    return (
        <button className={`choice-${getChoiceTone(choice.id)}`} disabled={disabled || !affordability.canRun} title={affordability.reason} onClick={() => onChoice(choice.id)}>
            <strong>{choice.label}</strong>
            <small>{affordability.canRun ? choice.hint : affordability.reason}</small>
            {preview.length ? <span className="choice-preview">{preview.join(" · ")}</span> : null}
        </button>
    );
}

function EventResultCard({ event }: { event: TownEvent }) {
    return (
        <div className="event-result-card">
            <div>
                <strong>行动结算</strong>
                <small>{getResultSummary(event)}</small>
            </div>
            <ResultBar event={event} />
        </div>
    );
}

export function AiCompanion({ save, pending, onOpenAdvice }: { save: TownSave; pending: boolean; onOpenAdvice: () => void }) {
    return (
        <button className={pending ? "ai-companion thinking" : "ai-companion"} onClick={onOpenAdvice}>
            <AssetImage src={ASSETS.npcs.cat} alt="AI 小镇助手" className="ai-companion-avatar" fallback={<span>AI</span>} />
            <span>
                <strong>{pending ? "思考中..." : "小镇助手"}</strong>
                <small>{createCompanionMessage(save)}</small>
            </span>
        </button>
    );
}

export function AiUsageConfirmCard({ onAccept, onCancel }: { onAccept: () => void; onCancel: () => void }) {
    return (
        <div className="ai-confirm-card">
            <AssetImage src={ASSETS.npcs.cat} alt="AI 小镇助手" className="ai-confirm-avatar" fallback={<span>AI</span>} />
            <div>
                <p className="game-eyebrow">小镇助手提示</p>
                <h3>使用 AI 生成内容</h3>
                <p>AI 内容会调用管理员配置的模型生成，可能消耗你的 AI 额度。</p>
                <div className="panel-actions">
                    <button className="game-primary" onClick={onAccept}>继续使用 AI</button>
                    <button className="game-secondary" onClick={onCancel}>暂不使用</button>
                </div>
            </div>
        </div>
    );
}

export function AdvicePanel({ save, latestEvent }: { save: TownSave; latestEvent: TownEvent | null }) {
    const plan = getStrategyPlan(save);
    const strategy = latestEvent?.type === "advice" ? latestEvent.result?.strategy : null;
    const advice = strategy?.summary ?? (latestEvent?.type === "advice" ? latestEvent.content : save.suggestion);
    return (
        <div className="strategy-panel">
            <section className="strategy-hero">
                <AssetImage src={ASSETS.npcs.cat} alt="AI 小镇助手" className="strategy-avatar" fallback={<span>AI</span>} />
                <div>
                    <p className="game-eyebrow">AI 小镇助手</p>
                    <h3>今日经营策略</h3>
                    <p>{advice}</p>
                    <p className="ai-usage-note">AI 建议会调用管理员配置的模型生成，可能消耗额度。</p>
                </div>
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
            <p>{settlement.summary}</p>
        </div>
    );
}

export function GameModalShell({ children, title, onClose }: { children: React.ReactNode; title: string; onClose: () => void }) {
    return (
        <motion.div className="game-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.section className="game-modal" initial={{ opacity: 0, scale: 0.94, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }} transition={{ duration: 0.18 }}>
                <header>
                    <h2>{title}</h2>
                    <button aria-label="关闭" onClick={onClose}>×</button>
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
                <button onClick={onOpenTasks}><GameIcon label="任" /><span>任务</span></button>
                <button onClick={onOpenEvents}><GameIcon label="志" /><span>日志</span></button>
                <button onClick={onOpenSettlement}><GameIcon label="月" /><span>日结</span></button>
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
    if (modal === "advice") return "AI 经营建议";
    if (modal === "settlement") return "每日结算";
    if (modal === "tasks") return "任务与目标";
    if (modal === "event") return "小镇事件";
    if (modal === "ai-confirm") return "AI 额度提示";
    return "小镇";
}

function EventImage({ eventType }: { eventType: string }) {
    const src = eventType === "operate" || eventType === "upgrade" ? ASSETS.screenshots.kitchen : eventType === "chat" || eventType === "visit" || eventType === "relationship" || eventType === "npc_story" ? ASSETS.screenshots.npc : eventType === "explore" || eventType === "unlock" || eventType === "festival" ? ASSETS.screenshots.nightEvent : ASSETS.screenshots.town;
    return <AssetImage src={src} alt="事件插图" className="event-image" />;
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
