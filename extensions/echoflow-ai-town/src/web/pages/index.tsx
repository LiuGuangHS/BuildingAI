import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

import { ASSETS } from "../assets";
import { AssetImage } from "../components/asset-image";
import { AdvicePanel, AiCompanion, AiUsageConfirmCard, BuildingPanel, EventCard, EventPanel, GameIcon, GameModalShell, GoalBoard, NpcHotspotAvatar, NpcPanel, ResourceMeter, ResourcePill, ResultBar, SavePicker, SettlementPanel, TaskPanel, getModalTitle, type GameModal } from "../components/game-panels";
import { findPrimaryEvent, getActionAffordability, getActionTask, getBuildingStatus, getNextReputationTarget, getRecommendedAction, getRecommendedTarget, getRelationshipLevel, isBuildingUpgradeable, resolveActionModal, resolveEventScene, townActions } from "../lib/game-rules";
import { chatWithTownCharacter, createTownSave, deleteTownSave, getTownSave, listTownSaves, runTownAction } from "../services/web/town";
import type { TownBuilding, TownCharacter, TownSave } from "../services/types";

type ChatResult = { reply: string; save: TownSave };
type PendingAiAction = { type: "advice" } | { type: "chat" } | null;

const AI_USAGE_NOTICE_KEY = "echoflow-ai-town-ai-usage-ack";

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
    const [aiUsageAcknowledged, setAiUsageAcknowledged] = useState(() => {
        if (typeof window === "undefined") return false;
        return window.localStorage.getItem(AI_USAGE_NOTICE_KEY) === "true";
    });

    const savesQuery = useQuery({
        queryKey: ["town-saves"],
        queryFn: listTownSaves,
    });

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
            setLastReply(result.reply);
            setScene("npc");
            if (result.save.events[0]?.id) setResultEventId(result.save.events[0].id);
            setModal("npc");
        },
        onError: (error) => setErrorMessage(getErrorMessage(error)),
    });

    const save = activeSave;
    const selectedBuilding = save?.worldState.buildings.find((building) => building.id === selectedBuildingId) ?? save?.worldState.buildings[0] ?? null;
    const latestEvent = save?.events[0] ?? null;
    const focusedEvent = save?.events.find((event) => event.id === focusedEventId) ?? latestEvent;
    const visibleResultEvent = latestEvent?.id === resultEventId ? latestEvent : null;
    const recommendedTarget = getRecommendedTarget(save);
    const recommendedAction = getRecommendedAction(save, recommendedTarget);

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
        setModal("building");
    }

    function openNpc(character: TownCharacter) {
        setActiveCharacter(character);
        setModal("npc");
    }

    function runAction(action: string, params?: { choiceId?: string; buildingId?: string }) {
        if (save) {
            const affordability = getActionAffordability(save, action, params?.buildingId);
            if (!affordability.canRun) {
                setErrorMessage(affordability.reason);
                return;
            }
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
        if (!confirmAiUsage({ type: "chat" })) return;
        chatMutation.mutate();
    }

    function acceptAiUsage() {
        window.localStorage.setItem(AI_USAGE_NOTICE_KEY, "true");
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
                <section className="game-title-screen">
                    <AssetImage src={ASSETS.cover} alt="AI乐园小镇封面" className="title-bg" fallback={<div className="pixel-town" />} />
                    <div className="title-vignette" />
                    <div className="title-content">
                        <div className="title-brand">
                            <AssetImage src={ASSETS.icon} alt="AI乐园小镇图标" className="game-icon" fallback={<span className="game-icon icon-fallback">镇</span>} />
                            <div>
                                <p className="game-eyebrow">EchoflowAI H5 Game</p>
                                <h1>AI乐园小镇</h1>
                                <p>经营餐馆、结识居民、探索夜晚事件，让每一天都在小镇里留下新的故事。</p>
                            </div>
                        </div>
                        <div className="title-actions">
                            <button className="game-primary" disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
                                {createMutation.isPending ? "创建中..." : "开始经营"}
                            </button>
                            {errorMessage ? <p className="game-error">{errorMessage}</p> : null}
                        </div>
                    </div>
                    <div className="save-dock">
                        {savesQuery.isLoading ? <p>正在读取旧存档...</p> : null}
                        {savesQuery.isError ? <p className="game-error">旧存档加载失败，请刷新后重试。</p> : null}
                        {savesQuery.data?.list?.length ? <SavePicker saves={savesQuery.data.list} pendingId={loadSaveMutation.variables} onDelete={(saveId) => deleteSaveMutation.mutate(saveId)} onLoad={(saveId) => loadSaveMutation.mutate(saveId)} /> : null}
                    </div>
                </section>
            ) : (
                <section className="game-stage">
                    <AssetImage src={ASSETS.backgrounds.town} alt="小镇当前地图" className="stage-bg" fallback={<div className="map-fallback" />} />
                    <div className={`stage-weather stage-weather-${save.worldState.weather}`} />
                    <div className="top-hud">
                        <div className="save-title">
                            <span>Day {save.day}</span>
                            <strong>{save.name}</strong>
                        </div>
                        <ResourcePill label="天气" value={save.worldState.weather} />
                        <ResourcePill label="金币" value={save.coins} />
                        <ResourceMeter label="体力" value={save.stamina} max={100} />
                        <ResourceMeter label="声望" value={save.worldState.reputation} max={getNextReputationTarget(save)} />
                        <ResourcePill label="心情" value={save.mood} />
                    </div>
                    <GoalBoard save={save} onOpenEvents={() => setModal("events")} onOpenSettlement={() => setModal("settlement")} onOpenTasks={() => setModal("tasks")} />
                    <div className="map-hotspots">
                        {save.worldState.buildings.map((building) => (
                            <button className={`building-hotspot hotspot-${building.id}${recommendedTarget === building.id ? " recommended" : ""}${isBuildingUpgradeable(save, building) ? " upgradeable" : ""}`} key={building.id} onClick={() => openBuilding(building)}>
                                <span>{building.name}</span>
                                <strong>Lv.{building.level}</strong>
                                <small>{getBuildingStatus(save, building)}</small>
                            </button>
                        ))}
                        {save.characters.slice(0, 4).map((character, index) => (
                            <button className={`npc-hotspot npc-hotspot-${index}${recommendedTarget === character.id ? " recommended" : ""}`} key={character.id} onClick={() => openNpc(character)}>
                                <NpcHotspotAvatar character={character} />
                                <span>{character.name} · {getRelationshipLevel(character.relationship)}</span>
                            </button>
                        ))}
                    </div>
                    <AiCompanion save={save} pending={actionMutation.isPending || chatMutation.isPending} onOpenAdvice={() => setModal("advice")} />
                    <div className="bottom-command-bar">
                        {townActions.map((action) => {
                            const affordability = save ? getActionAffordability(save, action.id) : { canRun: true, reason: "" };
                            const task = save ? getActionTask(save, action.id) : null;
                            return (
                                <button className={`${recommendedAction === action.id ? "recommended" : ""}${task ? " task-linked" : ""}`} key={action.id} disabled={actionMutation.isPending || !affordability.canRun} title={affordability.reason} onClick={() => runAction(action.id)}>
                                    {task ? <span className="action-badge">任务</span> : null}
                                    <GameIcon label={action.icon} />
                                    <strong>{action.title}</strong>
                                    <small>{affordability.canRun ? action.desc : affordability.reason}</small>
                                    <em>{action.hint}</em>
                                </button>
                            );
                        })}
                    </div>
                    {visibleResultEvent?.result ? <div className="floating-result"><ResultBar event={visibleResultEvent} /></div> : null}
                    {errorMessage ? <div className="game-toast error">{errorMessage}</div> : null}
                    <AnimatePresence>
                        {modal ? (
                        <GameModalShell key={modal} title={getModalTitle(modal, selectedBuilding, activeCharacter)} onClose={() => setModal(null)}>
                            {modal === "building" && selectedBuilding ? (
                                <BuildingPanel building={selectedBuilding} pending={actionMutation.isPending} save={save} onAction={runAction} />
                            ) : null}
                            {modal === "npc" ? (
                                <NpcPanel activeCharacter={activeCharacter} chatText={chatText} lastReply={lastReply} pending={chatMutation.isPending} save={save} setChatText={setChatText} setActiveCharacter={setActiveCharacter} onChat={runChat} />
                            ) : null}
                            {modal === "event" && focusedEvent ? <EventCard event={focusedEvent} pending={actionMutation.isPending} save={save} onBack={() => setModal(null)} onChoice={(choiceId) => runAction(choiceId, { choiceId })} /> : null}
                            {modal === "events" ? <EventPanel events={save.events} pending={actionMutation.isPending} save={save} onChoice={(choiceId) => runAction(choiceId, { choiceId })} /> : null}
                            {modal === "advice" ? <AdvicePanel save={save} latestEvent={latestEvent} /> : null}
                            {modal === "settlement" ? <SettlementPanel save={save} /> : null}
                            {modal === "tasks" ? <TaskPanel save={save} /> : null}
                            {modal === "ai-confirm" ? <AiUsageConfirmCard onAccept={acceptAiUsage} onCancel={() => { setPendingAiAction(null); setModal(null); }} /> : null}
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
    return "操作失败，请稍后再试";
}
