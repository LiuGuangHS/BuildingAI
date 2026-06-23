const assetBase = import.meta.env.BASE_URL.replace(/\/$/, "");
const asset = (path: string) => `${assetBase}${path}`;

export const ASSETS = {
    icon: asset("/assets/icon.png"),
    cover: asset("/assets/cover.png"),
    screenshots: {
        town: asset("/assets/screenshot-town.png"),
        kitchen: asset("/assets/screenshot-kitchen.png"),
        npc: asset("/assets/screenshot-npc.png"),
        nightEvent: asset("/assets/screenshot-night-event.png"),
    },
    backgrounds: {
        town: asset("/assets/screenshot-town.png"),
        kitchen: asset("/assets/game-bg-kitchen.png"),
        npc: asset("/assets/screenshot-npc.png"),
        night: asset("/assets/screenshot-night-event.png"),
        dashboard: asset("/assets/ui-dashboard-bg.png"),
    },
    npcs: {
        girl: asset("/assets/npc-girl.png"),
        chef: asset("/assets/npc-chef.png"),
        florist: asset("/assets/npc-florist.png"),
        traveler: asset("/assets/npc-traveler.png"),
        cat: asset("/assets/npc-cat.png"),
    },
    banner: asset("/assets/banner-town-night.png"),
} as const;

export function getNpcAsset(role: string) {
    if (role.includes("帮手")) return ASSETS.npcs.girl;
    if (role.includes("老板")) return ASSETS.npcs.chef;
    if (role.includes("花店")) return ASSETS.npcs.florist;
    if (role.includes("旅人")) return ASSETS.npcs.traveler;
    return ASSETS.npcs.cat;
}
