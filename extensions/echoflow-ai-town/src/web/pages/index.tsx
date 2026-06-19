import { Button } from "@buildingai/ui/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

import { ASSETS } from "../assets";
import { AssetImage } from "../components/asset-image";
import { AdvicePanel, AiCompanion, AiUsageConfirmCard, BuildingPanel, CommandSummary, CompactGoalBoard, EventCard, EventPanel, GameModalShell, NpcHotspotAvatar, NpcPanel, ResourceMeter, ResourcePill, ResultBar, SavePicker, SettlementPanel, TaskPanel, getModalTitle, type GameModal } from "../components/game-panels";
import { readAiUsageAcknowledged, writeAiUsageAcknowledged } from "../lib/ai-usage-storage";
import { findPrimaryEvent, resolveActionModal, resolveEventScene } from "../lib/game-rules";
import { createTownViewModel, getActionState } from "../lib/town-view-model";
import { chatWithTownCharacter, createTownSave, deleteTownSave, getTownSave, listTownSaves, runTownAction } from "../services/web/town";
import type { TownBuilding, TownCharacter, TownSave } from "../services/types";

type ChatResult = { reply: string; save: TownSave };
type PendingAiAction = { type: "advice" } | { type: "chat" } | null;

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
    const viewModel = save ? createTownViewModel(save) : null;
    const selectedBuilding = save?.worldState.buildings.find((building) => building.id === selectedBuildingId) ?? save?.worldState.buildings[0] ?? null;
    const latestEvent = save?.events[0] ?? null;
    const focusedEvent = save?.events.find((event) => event.id === focusedEventId) ?? latestEvent;
    const visibleResultEvent = latestEvent?.id === resultEventId ? latestEvent : null;

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
        if (!confirmAiUsage({ type: "chat" })) return;
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
                        <div className="onboarding-actions">
                            <Button type="button" variant="default" className="game-primary" disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
                                {createMutation.isPending ? "创建中..." : "创建小镇"}
                            </Button>
                            <span>进入后直接开始经营、拜访和探索。</span>
                        </div>
                        {errorMessage ? <p className="game-error">{errorMessage}</p> : null}
                    </div>
                    <div className="onboarding-command-preview">
                        {["经营", "拜访", "布置", "探索", "休息"].map((label) => <span key={label}>{label}</span>)}
                    </div>
                    <div className="save-dock onboarding-save-dock">
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
                            <span>Day {viewModel?.hud.day ?? save.day}</span>
                            <strong>{viewModel?.hud.name ?? save.name}</strong>
                        </div>
                        <ResourcePill label="天气" value={viewModel?.hud.weather ?? save.worldState.weather} />
                        <ResourcePill label="金币" value={viewModel?.hud.coins ?? save.coins} />
                        <ResourceMeter label="体力" value={viewModel?.hud.stamina ?? save.stamina} max={100} />
                        <ResourceMeter label="声望" value={viewModel?.hud.reputation.value ?? save.worldState.reputation} max={viewModel?.hud.reputation.target ?? save.worldState.reputation} />
                        <ResourcePill label="心情" value={viewModel?.hud.mood ?? save.mood} />
                    </div>
                    {viewModel ? <CompactGoalBoard goal={viewModel.goal} onOpenEvents={() => setModal("events")} onOpenSettlement={() => setModal("settlement")} onOpenTasks={() => setModal("tasks")} /> : null}
                    <div className="map-hotspots">
                        {viewModel?.buildings.map((building) => (
                            <Button type="button" variant="ghost" className={`building-hotspot hotspot-${building.id}${building.recommended ? " recommended" : ""}${building.upgradeable ? " upgradeable" : ""}`} key={building.id} onClick={() => openBuilding(building.building)}>
                                <span>{building.name}</span>
                                <strong>Lv.{building.level}</strong>
                                <small>{building.status}</small>
                            </Button>
                        ))}
                        {viewModel?.characters.slice(0, 4).map((character, index) => (
                            <Button type="button" variant="ghost" className={`npc-hotspot npc-hotspot-${index}${character.recommended ? " recommended" : ""}${character.pendingPromiseCount ? " has-memory-promise" : ""}`} key={character.id} title={character.pendingPromise ? `记着：${character.pendingPromise}` : character.memorySummary} onClick={() => openNpc(character.character)}>
                                <NpcHotspotAvatar character={character} />
                                <span>{character.name} · {character.relationshipLevel}</span>
                                {character.pendingPromiseCount ? <em>约定</em> : null}
                            </Button>
                        ))}
                    </div>
                    <AiCompanion save={save} pending={actionMutation.isPending || chatMutation.isPending} onOpenAdvice={() => setModal("advice")} />
                    {viewModel ? <CommandSummary commands={viewModel.commands} pending={actionMutation.isPending} onRun={runAction} /> : null}
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
                            {modal === "advice" ? <AdvicePanel save={save} latestEvent={latestEvent} onRunRecommendedAction={(action) => runAction(action)} /> : null}
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
