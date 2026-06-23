import { Button } from "@buildingai/ui/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

import { ASSETS } from "../assets";
import { AssetImage } from "../components/asset-image";
import { AdvicePanel, AiCompanion, AiUsageConfirmCard, BuildingPanel, CommandSummary, CompactGoalBoard, EventCard, EventPanel, GameModalShell, NpcHotspotAvatar, NpcPanel, ResourceMeter, ResourcePill, RewardToast, SavePicker, SettlementPanel, StageTurnStrip, TaskPanel, getModalTitle, type GameModal } from "../components/game-panels";
import { readAiUsageAcknowledged, writeAiUsageAcknowledged } from "../lib/ai-usage-storage";
import { findPrimaryEvent, resolveActionModal, resolveEventScene } from "../lib/game-rules";
import { createTownViewModel, getActionState, type TownBuildingHotspotViewModel, type TownCharacterHotspotViewModel, type TownSceneKind } from "../lib/town-view-model";
import { chatWithTownCharacter, createTownSave, deleteTownSave, getTownSave, listTownSaves, runTownAction } from "../services/web/town";
import type { TownBuilding, TownCharacter, TownSave } from "../services/types";

type ChatResult = { reply: string; save: TownSave };
type PendingAiAction = { type: "advice" } | { type: "chat"; characterName: string } | null;

const onboardingCommands = [
    { label: "经营", hint: "餐馆开张", preview: "金币 +20 · 今日任务" },
    { label: "拜访", hint: "回应居民", preview: "关系 +8 · 记忆线索" },
    { label: "布置", hint: "整理街角", preview: "心情提升 · 外观目标" },
    { label: "探索", hint: "发现事件", preview: "声望 +4 · 活动线索" },
    { label: "休息", hint: "进入日结", preview: "刷新行动 · 第二天目标" },
];

export default function TownIndexPage() {
    const queryClient = useQueryClient();
    const [activeSave, setActiveSave] = useState<TownSave | null>(null);
    const [activeCharacter, setActiveCharacter] = useState<TownCharacter | null>(null);
    const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
    const [chatText, setChatText] = useState("今晚适合举办什么活动？");
    const [lastReply, setLastReply] = useState("");
    const [scene, setScene] = useState<"town" | "kitchen" | "npc" | "night">("town");
    const [modal, setModal] = useState<GameModal>(null);
    const [errorMessage, setErrorMessage] = useState("");
    const [resultEventId, setResultEventId] = useState<string | null>(null);
    const [focusedEventId, setFocusedEventId] = useState<string | null>(null);
    const [pendingAiAction, setPendingAiAction] = useState<PendingAiAction>(null);
    const [aiUsageAcknowledged, setAiUsageAcknowledged] = useState(readAiUsageAcknowledged);

    const savesQuery = useQuery({
        queryKey: ["town-saves"],
        queryFn: listTownSaves,
        retry: false,
    });
    const townServiceAvailable = !savesQuery.isError;

    const createMutation = useMutation<TownSave, Error, void>({
        mutationFn: () => createTownSave("乐园小镇"),
        onSuccess: (result) => {
            setErrorMessage("");
            setActiveSave(result);
            setSelectedBuildingId(result.worldState.buildings[0]?.id ?? null);
            setScene("town");
            setModal(null);
            void queryClient.invalidateQueries({ queryKey: ["town-saves"] });
        },
        onError: (error) => setErrorMessage(getErrorMessage(error)),
    });

    const loadSaveMutation = useMutation<TownSave, Error, string>({
        mutationFn: (saveId: string) => getTownSave(saveId),
        onSuccess: (result) => {
            setErrorMessage("");
            setActiveSave(result);
            setActiveCharacter(null);
            setSelectedBuildingId(result.worldState.buildings[0]?.id ?? null);
            setLastReply("");
            setScene("town");
            setModal(null);
        },
        onError: (error) => setErrorMessage(getErrorMessage(error)),
    });

    const deleteSaveMutation = useMutation<{ success: boolean }, Error, string>({
        mutationFn: (saveId: string) => deleteTownSave(saveId),
        onSuccess: (_result, saveId) => {
            setErrorMessage("");
            if (activeSave?.id === saveId) {
                setActiveSave(null);
                setActiveCharacter(null);
                setSelectedBuildingId(null);
                setLastReply("");
                setScene("town");
                setModal(null);
            }
            void queryClient.invalidateQueries({ queryKey: ["town-saves"] });
        },
        onError: (error) => setErrorMessage(getErrorMessage(error)),
    });

    const actionMutation = useMutation<TownSave, Error, { action: string; choiceId?: string; buildingId?: string }>({
        mutationFn: ({ action, choiceId, buildingId }) => {
            if (!activeSave) throw new Error("No active save");
            return runTownAction(activeSave.id, action, choiceId, buildingId);
        },
        onSuccess: (result) => {
            setErrorMessage("");
            setActiveSave(result);
            const latestEvent = findPrimaryEvent(result.events, actionMutation.variables?.action);
            if (latestEvent?.id) setResultEventId(latestEvent.id);
            setScene(resolveEventScene(latestEvent?.type));
            if (latestEvent?.id) setFocusedEventId(latestEvent.id);
            setModal(resolveActionModal(actionMutation.variables?.action, latestEvent?.type));
            void queryClient.invalidateQueries({ queryKey: ["town-saves"] });
        },
        onError: (error) => setErrorMessage(getErrorMessage(error)),
    });

    const chatMutation = useMutation<ChatResult, Error, void>({
        mutationFn: () => {
            if (!activeSave || !activeCharacter) throw new Error("No character selected");
            return chatWithTownCharacter(activeSave.id, activeCharacter.id, chatText);
        },
        onSuccess: (result) => {
            setErrorMessage("");
            setActiveSave(result.save);
            const updatedCharacter = result.save.characters.find((character) => character.id === activeCharacter?.id);
            if (updatedCharacter) setActiveCharacter(updatedCharacter);
            setLastReply(result.reply);
            setChatText("");
            setScene("npc");
            if (result.save.events[0]?.id) setResultEventId(result.save.events[0].id);
            setModal("npc");
        },
        onError: (error) => setErrorMessage(getErrorMessage(error)),
    });

    const save = activeSave;
    const viewModel = save ? createTownViewModel(save) : null;
    const selectedBuilding = save?.worldState.buildings.find((building) => building.id === selectedBuildingId) ?? save?.worldState.buildings[0] ?? null;
    const latestEvent = save?.events[0] ?? null;
    const focusedEvent = save?.events.find((event) => event.id === focusedEventId) ?? latestEvent;
    const visibleResultEvent = latestEvent?.id === resultEventId ? latestEvent : null;
    const scenePresentation = getScenePresentation(scene, latestEvent, selectedBuilding, activeCharacter);
    const pendingAction = actionMutation.isPending ? actionMutation.variables?.action : chatMutation.isPending ? "chat" : undefined;

    useEffect(() => {
        if (!errorMessage) return;
        const timer = window.setTimeout(() => setErrorMessage(""), 3200);
        return () => window.clearTimeout(timer);
    }, [errorMessage]);

    useEffect(() => {
        if (!resultEventId) return;
        const timer = window.setTimeout(() => setResultEventId(null), 2800);
        return () => window.clearTimeout(timer);
    }, [resultEventId]);

    function openBuilding(building: TownBuilding) {
        setSelectedBuildingId(building.id);
        setScene(resolveBuildingScene(building.id));
        setModal("building");
    }

    function selectNpc(character: TownCharacter) {
        setActiveCharacter(character);
        setLastReply("");
        setChatText("");
        setScene("npc");
        setModal("npc");
    }

    function runAction(action: string, params?: { choiceId?: string; buildingId?: string }) {
        const actionState = save ? getActionState(save, action, params?.buildingId) : null;
        if (actionState && !actionState.canRun) {
            setErrorMessage(actionState.disabledReason);
            return;
        }
        if (action === "advice" && !confirmAiUsage({ type: "advice" })) return;
        actionMutation.mutate({ action, ...params });
    }

    function confirmAiUsage(action: PendingAiAction) {
        if (aiUsageAcknowledged) return true;
        setPendingAiAction(action);
        setModal("ai-confirm");
        return false;
    }

    function runChat() {
        if (!activeCharacter) return;
        if (!confirmAiUsage({ type: "chat", characterName: activeCharacter.name })) return;
        chatMutation.mutate();
    }

    function acceptAiUsage() {
        writeAiUsageAcknowledged();
        setAiUsageAcknowledged(true);
        const action = pendingAiAction;
        setPendingAiAction(null);
        setModal(action?.type === "chat" ? "npc" : null);
        if (action?.type === "advice") actionMutation.mutate({ action: "advice" });
        if (action?.type === "chat") chatMutation.mutate();
    }

    return (
        <main className="town-game-shell">
            {!save ? (
                <section className="game-stage onboarding-stage">
                    <AssetImage src={ASSETS.backgrounds.town} alt="乐园小镇地图" className="stage-bg" fallback={<div className="map-fallback" />} />
                    <div className="stage-weather stage-weather-晴朗" />
                    <div className="top-hud onboarding-hud">
                        <div className="save-title">
                            <span>Day 1</span>
                            <strong>乐园小镇</strong>
                        </div>
                        <ResourcePill label="天气" value="晴朗" />
                        <ResourcePill label="金币" value="120" />
                        <ResourceMeter label="体力" value={100} max={100} />
                        <ResourcePill label="心情" value="期待" />
                    </div>
                    <div className="onboarding-hotspots" aria-hidden="true">
                        <span className="building-hotspot hotspot-restaurant preview-hotspot"><strong>暖光餐馆</strong><small>可经营</small></span>
                        <span className="building-hotspot hotspot-florist preview-hotspot"><strong>风铃花店</strong><small>可拜访</small></span>
                        <span className="building-hotspot hotspot-square preview-hotspot"><strong>中央广场</strong><small>可探索</small></span>
                        <span className="npc-hotspot npc-hotspot-0 preview-hotspot"><i className="npc-preview-avatar" aria-hidden="true">小</i><span>小满 · 熟悉</span></span>
                        <span className="npc-hotspot npc-hotspot-2 preview-hotspot"><i className="npc-preview-avatar" aria-hidden="true">花</i><span>花音 · 熟悉</span></span>
                    </div>
                    <div className="onboarding-panel">
                        <div>
                            <p className="game-eyebrow">晨间开张</p>
                            <h1>乐园小镇</h1>
                            <p>第一天已经亮起来。餐馆、花店和广场都在等你安排，居民会把今天的选择记进之后的故事。</p>
                        </div>
                        <div className="onboarding-quest-card" aria-label="开张路线">
                            <span>开张路线</span>
                            <ol className="onboarding-quest-steps">
                                <li>先经营餐馆</li>
                                <li>再拜访居民</li>
                                <li>最后休息结算</li>
                            </ol>
                            <p>完成后会留下关系、约定和第二天目标。</p>
                        </div>
                        <div className="onboarding-growth-card" aria-label="成长预览">
                            <span>成长预览</span>
                            <div className="onboarding-growth-lanes">
                                {["故事", "记忆", "章节", "活动", "外观"].map((item) => <em key={item}>{item}</em>)}
                            </div>
                            <p>不是购买入口，正式扣费和订阅权益接入后再开放。</p>
                        </div>
                        <div className="onboarding-actions">
                                <Button type="button" variant="default" className="game-primary" disabled={createMutation.isPending || !townServiceAvailable} onClick={() => createMutation.mutate()}>
                                        {!townServiceAvailable ? "等待镇务服务" : createMutation.isPending ? "小镇开张中" : "开张小镇"}
                                </Button>
                            {townServiceAvailable ? <span>开张后直接开始经营、拜访和探索。</span> : <span>先保留小镇预览，连接恢复后再开张。</span>}
                        </div>
                            {errorMessage ? <p className="game-error" role="alert">{errorMessage}</p> : null}
                    </div>
                    <div className="onboarding-command-preview">
                        {onboardingCommands.map((command) => <span className="onboarding-command-card" aria-label={`${command.label}：${command.hint}，${command.preview}`} key={command.label}><strong>{command.label}</strong><small>{command.hint}</small><em>{command.preview}</em></span>)}
                    </div>
                    <div className="save-dock onboarding-save-dock">
                            {savesQuery.isLoading ? <p>正在翻看旧存档</p> : null}
                        {savesQuery.isError ? (
                            <div className="onboarding-service-card">
                                <p className="onboarding-service-note" role="status" aria-live="polite">镇务服务暂时未连接，仍可预览小镇场景和今日命令；请重试连接后开张或回到旧档。</p>
                                    <Button type="button" variant="outline" className="game-secondary onboarding-retry" disabled={savesQuery.isFetching} onClick={() => void savesQuery.refetch()}>
                                        {savesQuery.isFetching ? "重连镇务中" : "重试连接"}
                                    </Button>
                            </div>
                        ) : null}
                        {savesQuery.data?.list?.length ? <SavePicker saves={savesQuery.data.list} pendingId={loadSaveMutation.variables} onDelete={(saveId) => deleteSaveMutation.mutate(saveId)} onLoad={(saveId) => loadSaveMutation.mutate(saveId)} /> : null}
                    </div>
                </section>
            ) : (
                <section className={`game-stage scene-${scene}`}>
                    <AssetImage src={scenePresentation.background} alt={scenePresentation.alt} className="stage-bg" fallback={<div className="map-fallback" />} />
                    <div className={`stage-weather stage-weather-${save.worldState.weather}`} />
                    <div className="top-hud">
                        <div className="save-title">
                            <span>Day {viewModel?.hud.day ?? save.day}</span>
                            <strong>{viewModel?.hud.name ?? save.name}</strong>
                        </div>
                        <ResourcePill label="天气" value={viewModel?.hud.weather ?? save.worldState.weather} />
                        <ResourcePill label="金币" value={viewModel?.hud.coins ?? save.coins} />
                        <ResourceMeter label="体力" value={viewModel?.hud.stamina ?? save.stamina} max={100} />
                        <ResourceMeter label="声望" value={viewModel?.hud.reputation.value ?? save.worldState.reputation} max={viewModel?.hud.reputation.target ?? save.worldState.reputation} />
                        <ResourcePill label="心情" value={viewModel?.hud.mood ?? save.mood} />
                    </div>
                    <div className="scene-director">
                        <span>{scenePresentation.label}</span>
                        <strong>{scenePresentation.title}</strong>
                        <small>{scenePresentation.desc}</small>
                        {scene !== "town" ? (
                            <Button type="button" variant="ghost" size="sm" onClick={() => setScene("town")}>返回地图</Button>
                        ) : null}
                    </div>
                    {viewModel ? <StageTurnStrip save={save} goal={viewModel.goal} recommendedAction={viewModel.recommendedAction} onOpenTasks={() => setModal("tasks")} /> : null}
                    {viewModel ? <CompactGoalBoard goal={viewModel.goal} save={save} onOpenEvents={() => setModal("events")} onOpenSettlement={() => setModal("settlement")} onOpenTasks={() => setModal("tasks")} /> : null}
                    <div className={scene === "town" ? "map-hotspots" : "map-hotspots scene-dimmed"} aria-hidden={scene !== "town"}>
                        {viewModel?.buildings.map((building) => (
                            <Button type="button" variant="ghost" aria-label={getBuildingHotspotLabel(building)} className={`building-hotspot hotspot-${building.id}${building.recommended ? " recommended" : ""}${building.upgradeable ? " upgradeable" : ""}`} disabled={scene !== "town"} key={building.id} onClick={() => openBuilding(building.building)}>
                                <span>{building.name}</span>
                                <strong>Lv.{building.level}</strong>
                                <small>{building.status}</small>
                                <span className="hotspot-action-line">{building.disabledReason ?? "可行动"}</span>
                                {building.upgradeable ? <em className="hotspot-upgrade">可升级</em> : null}
                            </Button>
                        ))}
                            {viewModel?.characters.slice(0, 4).map((character, index) => (
                                <Button type="button" variant="ghost" aria-label={getCharacterHotspotLabel(character)} className={`npc-hotspot npc-hotspot-${index}${character.recommended ? " recommended" : ""}${character.pendingPromiseCount ? " has-memory-promise" : ""}`} disabled={scene !== "town"} key={character.id} title={character.pendingPromise ? `记着：${character.pendingPromise}` : character.memorySummary} onClick={() => selectNpc(character.character)}>
                                <NpcHotspotAvatar character={character} />
                                <span>{character.name} · {character.relationshipLevel}</span>
                                <span className="npc-hotspot-meta">{character.pendingPromise ?? character.status}</span>
                                <span className="npc-relationship-mini"><i style={{ width: `${Math.min(100, Math.max(0, character.relationship))}%` }} /></span>
                                {character.pendingPromiseCount ? <em>约定</em> : null}
                            </Button>
                        ))}
                    </div>
                        {viewModel ? <AiCompanion save={save} goal={viewModel.goal} pending={actionMutation.isPending || chatMutation.isPending} onOpenAdvice={() => setModal("advice")} /> : null}
                    {viewModel ? <CommandSummary commands={viewModel.commands} pending={actionMutation.isPending} onRun={runAction} /> : null}
                    <ActionPendingBanner action={pendingAction} characterName={activeCharacter?.name} />
                    {visibleResultEvent?.result ? <div className="floating-result"><RewardToast event={visibleResultEvent} /></div> : null}
                    {errorMessage ? <div className="game-toast error" role="alert" aria-live="assertive">{errorMessage}</div> : null}
                    <AnimatePresence>
                        {modal ? (
                        <GameModalShell key={modal} title={getModalTitle(modal, selectedBuilding, activeCharacter)} onClose={() => setModal(null)}>
                            {modal === "building" && selectedBuilding ? (
                                <BuildingPanel building={selectedBuilding} pending={actionMutation.isPending} save={save} onAction={runAction} />
                            ) : null}
                            {modal === "npc" ? (
                                    <NpcPanel activeCharacter={activeCharacter} chatText={chatText} lastReply={lastReply} pending={chatMutation.isPending} save={save} setChatText={setChatText} setActiveCharacter={selectNpc} onChat={runChat} />
                            ) : null}
                            {modal === "event" && focusedEvent ? <EventCard event={focusedEvent} pending={actionMutation.isPending} save={save} onBack={() => setModal(null)} onChoice={(choiceId) => runAction(choiceId, { choiceId })} /> : null}
                            {modal === "events" ? <EventPanel events={save.events} pending={actionMutation.isPending} save={save} onChoice={(choiceId) => runAction(choiceId, { choiceId })} /> : null}
                            {modal === "advice" ? <AdvicePanel save={save} latestEvent={latestEvent} onRunRecommendedAction={(action) => runAction(action)} /> : null}
                            {modal === "settlement" ? <SettlementPanel save={save} onRest={() => runAction("rest")} /> : null}
                            {modal === "tasks" ? <TaskPanel save={save} onRunGoalAction={(action, params) => runAction(action, params)} onRunRetentionAction={(action) => runAction(action)} /> : null}
                                {modal === "ai-confirm" ? <AiUsageConfirmCard kind={pendingAiAction?.type ?? "advice"} characterName={pendingAiAction?.type === "chat" ? pendingAiAction.characterName : undefined} onAccept={acceptAiUsage} onCancel={() => { setPendingAiAction(null); setModal(null); }} /> : null}
                        </GameModalShell>
                    ) : null}
                    </AnimatePresence>
                </section>
            )}
        </main>
    );
}

function getErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return "小镇行动未完成，请稍后再试。";
}

function ActionPendingBanner({ action, characterName }: { action?: string; characterName?: string }) {
    if (!action) return null;
    const copy = getPendingActionCopy(action, characterName);
    return (
        <div className="action-pending-banner" role="status" aria-live="polite">
            <span>{copy.label}</span>
            <strong>{copy.detail}</strong>
        </div>
    );
}

function getPendingActionCopy(action?: string, characterName?: string) {
    switch (action) {
        case "operate": return { label: "经营餐馆中", detail: "厨房正在结算金币、体力和今日任务。" };
        case "visit": return { label: "拜访居民中", detail: "关系、记忆约定和居民回应正在写入小镇。" };
        case "decorate": return { label: "布置小镇中", detail: "心情、外观目标和街角状态正在更新。" };
        case "explore": return { label: "探索街区中", detail: "声望、事件线索和活动机会正在展开。" };
        case "upgrade": return { label: "升级建筑中", detail: "资源扣除、建筑等级和新解锁正在结算。" };
        case "rest": return { label: "休息结算中", detail: "日结、行动刷新和第二天目标正在排布。" };
        case "advice": return { label: "镇务排班中", detail: "参谋正在读取资源、任务和记忆线索。" };
        case "chat": return { label: characterName ? `和${characterName}交流中` : "和居民交流中", detail: "居民回复会参考关系、记忆和今天的行动。" };
        default: return { label: "小镇行动中", detail: "规则、资源和事件记录正在写入存档。" };
    }
}

function resolveBuildingScene(buildingId: string): TownSceneKind {
    if (buildingId === "restaurant") return "kitchen";
    if (buildingId === "square") return "night";
    return "town";
}

function getBuildingHotspotLabel(building: TownBuildingHotspotViewModel) {
    const state = building.disabledReason || "可行动";
    const flags = [building.recommended ? "今日推荐" : "", building.upgradeable ? "可升级" : ""].filter(Boolean);
    return [building.name, `等级 ${building.level}`, building.status, state, ...flags].join("，");
}

function getCharacterHotspotLabel(character: TownCharacterHotspotViewModel) {
    const promise = character.pendingPromise ? `记着约定：${character.pendingPromise}` : character.memorySummary;
    const flags = [character.recommended ? "今日推荐" : "", character.pendingPromiseCount ? `${character.pendingPromiseCount} 个待回应约定` : ""].filter(Boolean);
    return [character.name, character.relationshipLevel, `关系 ${character.relationship}`, character.status, promise, ...flags].join("，");
}

function getScenePresentation(scene: TownSceneKind, latestEvent: TownSave["events"][number] | null, building: TownBuilding | null, character: TownCharacter | null) {
    if (scene === "kitchen") {
        return {
            label: "经营现场",
            title: building?.id === "restaurant" ? "暖光餐馆开张中" : "后厨灯火亮起",
            desc: latestEvent?.type === "operate" ? latestEvent.title : "适合经营餐馆、检查收入和安排升级。",
            background: ASSETS.backgrounds.kitchen,
            alt: "餐馆经营场景",
        };
    }
    if (scene === "npc") {
        return {
            label: "居民时刻",
            title: character ? `和${character.name}碰面` : "居民正在街角等你",
            desc: latestEvent?.type === "chat" || latestEvent?.type === "visit" ? latestEvent.title : "拜访会推进关系，也可能让居民记起之前的约定。",
            background: ASSETS.backgrounds.npc,
            alt: "居民对话场景",
        };
    }
    if (scene === "night") {
        return {
            label: "街区事件",
            title: latestEvent?.type === "rest" ? "夜幕下的小镇结算" : "夜市街角亮起线索",
            desc: latestEvent?.title ?? "探索、节庆和日结会让小镇进入更有戏剧性的时段。",
            background: ASSETS.backgrounds.night,
            alt: "夜晚小镇事件场景",
        };
    }
    return {
        label: "小镇地图",
        title: "今日行动从这里开始",
        desc: latestEvent?.title ?? "选择建筑、居民或行动，推进今天的小镇循环。",
        background: ASSETS.backgrounds.town,
        alt: "小镇当前地图",
    };
}
